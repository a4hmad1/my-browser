<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Cinema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class CinemaTest extends TestCase
{
    use RefreshDatabase;

    private function member(array $attrs = []): User
    {
        $u = User::factory()->create();
        $u->forceFill(array_merge(['trial_ends_at' => now()->addDay()], $attrs))->save();

        return $u;
    }

    private function bearer(User $u): string
    {
        return app(Cinema::class)->issue($u, 'desktop', [], 43200);
    }

    public function test_registration_access_and_duplicate_email(): void
    {
        $this->freezeTime();
        $data = ['telegram_username' => 'movie_fan', 'name' => 'Movie Fan', 'email' => 'fan@example.com', 'password' => 'a-secure-password', 'password_confirmation' => 'a-secure-password'];
        $r = $this->postJson('/api/register', $data)->assertOk()->assertJsonPath('access.active', true)->assertJsonPath('access.trial', true);
        $u = User::where('email', $data['email'])->firstOrFail();
        $this->assertTrue($u->trial_ends_at->timestamp === now()->addDay()->timestamp);
        $this->assertDatabaseHas('cinema_tokens', ['digest' => hash('sha256', $r->json('token'))]);
        $this->assertDatabaseMissing('cinema_tokens', ['digest' => $r->json('token')]);
        $this->assertTrue(Hash::check($data['password'], $u->password));
        $this->postJson('/api/register', $data)->assertUnprocessable();
    }

    public function test_guest_expired_and_suspended_users_cannot_get_catalog(): void
    {
        $this->getJson('/api/catalog')->assertUnauthorized();
        $u = $this->member();
        $token = $this->bearer($u);
        $this->withToken($token)->getJson('/api/catalog')->assertOk();
        $this->travel(25)->hours();
        $this->withToken($token)->getJson('/api/catalog')->assertForbidden();
        $u->forceFill(['trial_ends_at' => now()->addDay(), 'suspended' => true])->save();
        $this->withToken($token)->getJson('/api/catalog')->assertForbidden();
    }

    public function test_subscription_token_is_bound_single_use_and_yearly_duration(): void
    {
        $this->freezeTime();
        $u = $this->member(['trial_ends_at' => now()->subDay()]);
        $other = $this->member();
        $c = app(Cinema::class);
        $code = $c->issue($u, 'subscription', ['plan' => 'plus', 'months' => 12], 100);
        $this->withToken($this->bearer($other))->postJson('/api/subscription/activate', ['token' => $code])->assertUnprocessable();
        $t = $this->bearer($u);
        $this->withToken($t)->postJson('/api/subscription/activate', ['token' => $code])->assertOk()->assertJsonPath('access.plan', 'plus');
        $this->assertTrue($u->fresh()->subscription_ends_at->timestamp === now()->addMonthsNoOverflow(12)->timestamp);
        $this->withToken($t)->postJson('/api/subscription/activate', ['token' => $code])->assertUnprocessable();
    }

    public function test_expired_activation_token_and_suspended_activation_are_rejected(): void
    {
        $u = $this->member();
        $t = $this->bearer($u);
        $c = app(Cinema::class);
        $expired = $c->issue($u, 'subscription', ['plan' => 'basic', 'months' => 1], -1);
        $this->withToken($t)->postJson('/api/subscription/activate', ['token' => $expired])->assertUnprocessable();
        $code = $c->issue($u, 'subscription', ['plan' => 'basic', 'months' => 1]);
        $u->forceFill(['suspended' => true])->save();
        $this->withToken($t)->postJson('/api/subscription/activate', ['token' => $code])->assertUnprocessable();
        $this->assertDatabaseHas('cinema_tokens', ['digest' => hash('sha256', $code), 'consumed_at' => null]);
    }

    public function test_basic_cannot_add_sites_plus_limit_is_enforced_and_sites_are_private(): void
    {
        $basic = $this->member();
        $this->withToken($this->bearer($basic))->postJson('/api/sites', ['name' => 'Movie', 'url' => 'https://movies.example.com'])->assertForbidden();
        $plus = $this->member(['plan' => 'plus', 'subscription_ends_at' => now()->addMonth()]);
        $t = $this->bearer($plus);
        for ($i = 0; $i < 10; $i++) {
            $this->withToken($t)->postJson('/api/sites', ['name' => 'Movie '.$i, 'url' => 'https://movies'.$i.'.example.com'])->assertOk();
        }
        $this->withToken($t)->postJson('/api/sites', ['name' => 'Too many', 'url' => 'https://example.com'])->assertUnprocessable();
        $id = DB::table('custom_sites')->where('user_id', $plus->id)->value('id');
        $this->withToken($this->bearer($basic))->deleteJson('/api/sites/'.$id)->assertOk();
        $this->assertDatabaseHas('custom_sites', ['id' => $id]);
        $this->withToken($t)->patchJson('/api/sites/'.$id, ['favorite' => true])->assertOk();
        $this->assertDatabaseHas('custom_sites', ['id' => $id, 'favorite' => true]);
    }

    public function test_unsafe_personal_website_urls_are_rejected(): void
    {
        $u = $this->member(['plan' => 'pro', 'subscription_ends_at' => now()->addYear()]);
        $t = $this->bearer($u);
        foreach (['file:///etc/passwd', 'https://127.0.0.1', 'https://100.64.0.1', 'https://example.local', 'https://name:password@example.com', 'https://netflix.com', 'https://www.primevideo.com'] as $url) {
            $this->withToken($t)->postJson('/api/sites', ['name' => 'Unsafe', 'url' => $url])->assertUnprocessable();
        }
    }

    public function test_admin_routes_require_admin_and_do_not_allow_self_suspension(): void
    {
        $u = $this->member();
        $this->actingAs($u)->get('/admin')->assertRedirect('/owner-login');
        $this->actingAs($u)->post('/admin/users/'.$u->id.'/tokens', ['plan' => 'pro', 'months' => 12])->assertForbidden();
        $a = $this->member(['is_admin' => true]);
        $this->actingAs($a)->get('/admin')->assertOk()->assertInertia(fn (AssertableInertia $p) => $p->component('Admin')->has('users'));
        $this->actingAs($a)->patch('/admin/users/'.$u->id, ['suspended' => true])->assertRedirect();
        $this->assertTrue($u->fresh()->suspended);
        $this->actingAs($a)->post('/admin/users/'.$u->id.'/tokens', ['plan' => 'pro', 'months' => 12])->assertRedirect()->assertSessionHas('token');
        $this->assertDatabaseHas('admin_events', ['admin_id' => $a->id, 'user_id' => $u->id, 'action' => 'issue-subscription']);
        $this->actingAs($a)->patch('/admin/users/'.$a->id, ['suspended' => true])->assertUnprocessable();
    }

    public function test_member_can_switch_to_owner_account_without_exposing_admin_actions(): void
    {
        $member = $this->member();
        $owner = $this->member(['is_admin' => true, 'password' => Hash::make('owner-password')]);

        $this->actingAs($member)->get('/admin')->assertRedirect('/owner-login');
        $this->get('/owner-login')->assertInertia(fn (AssertableInertia $page) => $page->component('Auth')->where('mode', 'owner'));
        $this->post('/owner-login', ['email' => $member->email, 'password' => 'password'])->assertSessionHasErrors('email');
        $this->post('/admin/users/'.$member->id.'/tokens', ['plan' => 'pro', 'months' => 1])->assertForbidden();
        $this->post('/owner-login', ['email' => $owner->email, 'password' => 'owner-password'])->assertRedirect('/admin');
        $this->get('/admin')->assertOk();
    }

    public function test_telegram_requires_secret_private_chat_and_linked_identity(): void
    {
        config(['cinema.telegram_secret' => 'test-secret', 'cinema.telegram_token' => 'test-bot', 'cinema.telegram_username' => 'CinemaBot']);
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true])]);
        $this->postJson('/api/telegram/webhook', [])->assertForbidden();
        $u = $this->member();
        $c = app(Cinema::class);
        $link = $c->issue($u, 'telegram');
        $message = ['message' => ['chat' => ['id' => 123, 'type' => 'private'], 'from' => ['id' => 123], 'text' => '/start '.$link]];
        $this->withHeader('X-Telegram-Bot-Api-Secret-Token', 'test-secret')->postJson('/api/telegram/webhook', $message)->assertOk();
        $this->assertSame('123', $u->fresh()->telegram_id);
        $message['message']['text'] = '/reset';
        $this->postJson('/api/telegram/webhook', $message)->assertOk();
        $this->assertDatabaseHas('cinema_tokens', ['user_id' => $u->id, 'purpose' => 'reset', 'consumed_at' => null]);
        Http::assertSent(fn ($r) => str_contains($r['text'], 'reset code'));
        $other = $this->member();
        $link2 = $c->issue($other, 'telegram');
        $message['message']['text'] = '/start '.$link2;
        $this->postJson('/api/telegram/webhook', $message)->assertOk();
        $this->assertNull($other->fresh()->telegram_id);
        $message['message']['chat'] = ['id' => -999, 'type' => 'group'];
        $this->postJson('/api/telegram/webhook', $message)->assertOk();
        $this->assertNull($other->fresh()->telegram_id);
    }

    public function test_reset_code_is_one_time_expires_and_revokes_desktop_and_sessions(): void
    {
        $u = $this->member();
        $c = app(Cinema::class);
        $t = $this->bearer($u);
        $code = $c->issue($u, 'reset', [], 10);
        $d = ['email' => $u->email, 'token' => $code, 'password' => 'new-password-123', 'password_confirmation' => 'new-password-123'];
        $this->postJson('/api/reset-password', $d)->assertOk();
        $this->assertTrue(Hash::check($d['password'], $u->fresh()->password));
        $this->withToken($t)->getJson('/api/account')->assertUnauthorized();
        $this->postJson('/api/reset-password', $d)->assertUnprocessable();
        $d['token'] = $c->issue($u, 'reset', [], -1);
        $this->postJson('/api/reset-password', $d)->assertUnprocessable();
    }

    public function test_downloads_fail_truthfully_until_configured_then_redirect_to_r2(): void
    {
        config(['cinema.downloads.windows' => null]);
        $this->get('/download/windows')->assertStatus(503);
        config(['cinema.downloads.windows' => 'https://downloads.example.com/CineStream.exe']);
        $this->get('/download/windows')->assertRedirect('https://downloads.example.com/CineStream.exe');
        $this->get('/download/unknown')->assertNotFound();
    }

    public function test_login_rate_limit_and_logout_revocation(): void
    {
        $u = $this->member();
        $t = $this->bearer($u);
        $this->withToken($t)->postJson('/api/logout')->assertOk();
        $this->withToken($t)->getJson('/api/account')->assertUnauthorized();
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/login', ['email' => 'wrong@example.com', 'password' => 'wrong'])->assertUnprocessable();
        }
        $this->postJson('/api/login', ['email' => 'wrong@example.com', 'password' => 'wrong'])->assertTooManyRequests();
    }
}
