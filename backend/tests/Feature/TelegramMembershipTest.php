<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Cinema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class TelegramMembershipTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['cinema.telegram_token' => 'fake-token', 'cinema.telegram_username' => 'CinemaBot', 'cinema.telegram_secret' => 'fake-secret']);
    }

    private function member(bool $verified = true): User
    {
        $u = User::factory()->create();
        $u->forceFill(['telegram_username' => 'member_'.$u->id, 'telegram_id' => $verified ? (string) (123000 + $u->id) : null, 'telegram_verified_at' => $verified ? now() : null, 'trial_ends_at' => now()->addDay()])->save();

        return $u;
    }

    public function test_registration_requires_username_and_bot_identity_then_one_use_confirmation(): void
    {
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true])]);
        $data = ['name' => 'Movie fan', 'email' => 'new@example.com', 'password' => 'a-strong-password', 'password_confirmation' => 'a-strong-password'];
        $this->postJson('/api/register', $data)->assertUnprocessable()->assertJsonValidationErrors('telegram_username');
        $data['telegram_username'] = '@Movie_Fan';
        $r = $this->postJson('/api/register', $data)->assertOk()->assertJsonPath('access.active', false)->assertJsonPath('access.telegram_required', true);
        $u = User::where('email', $data['email'])->firstOrFail();
        $this->assertSame('movie_fan', $u->telegram_username);
        parse_str(parse_url($r->json('telegram_url'), PHP_URL_QUERY), $query);
        $msg = ['message' => ['chat' => ['id' => 701, 'type' => 'private'], 'from' => ['id' => 701, 'username' => 'wrong_person'], 'text' => '/start '.$query['start']]];
        $this->withHeader('X-Telegram-Bot-Api-Secret-Token', 'fake-secret')->postJson('/api/telegram/webhook', $msg)->assertOk();
        $this->assertNull($u->fresh()->telegram_id);
        $this->assertDatabaseHas('cinema_tokens', ['digest' => hash('sha256', $query['start']), 'consumed_at' => null]);
        $msg['message']['from']['username'] = 'Movie_Fan';
        $this->postJson('/api/telegram/webhook', $msg)->assertOk();
        $this->assertSame('701', $u->fresh()->telegram_id);
        $sent = Http::recorded()->last()[0];
        preg_match('/[a-f0-9]{48}/', $sent['text'], $match);
        $code = $match[0];
        $other = $this->member();
        $this->actingAs($other)->postJson('/telegram/verify', ['token' => $code])->assertUnprocessable();
        $this->actingAs($u)->postJson('/telegram/verify', ['token' => $code])->assertRedirect();
        $this->assertNotNull($u->fresh()->telegram_verified_at);
        $this->assertTrue($u->fresh()->access()['active']);
        $this->actingAs($u)->postJson('/telegram/verify', ['token' => $code])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $u->email, 'password' => 'a-strong-password'])->assertOk();
        $this->postJson('/api/login', ['email' => $u->email, 'password' => 'wrong-password'])->assertUnprocessable();
    }

    public function test_plan_request_owner_approval_and_telegram_delivery_are_user_bound_and_idempotent(): void
    {
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true])]);
        $u = $this->member();
        $unverified = $this->member(false);
        $admin = $this->member();
        $admin->forceFill(['is_admin' => true])->save();
        $this->actingAs($unverified)->postJson('/subscription/request', ['plan' => 'plus', 'months' => 12])->assertUnprocessable();
        $this->actingAs($u)->post('/subscription/request', ['plan' => 'plus', 'months' => 12])->assertRedirect();
        $row = DB::table('subscription_requests')->first();
        $this->assertSame(114000, $row->amount);
        $this->actingAs($u)->postJson('/subscription/request', ['plan' => 'pro', 'months' => 1])->assertUnprocessable();
        $this->actingAs($u)->postJson('/admin/requests/'.$row->id.'/approve')->assertForbidden();
        $this->actingAs($admin)->get('/admin')->assertInertia(fn (AssertableInertia $p) => $p->component('Admin')->where('stats.pending', 1)->has('requests', 1)->where('requests.0.id', $row->id));
        $this->actingAs($admin)->post('/admin/requests/'.$row->id.'/approve')->assertRedirect();
        $this->assertDatabaseHas('subscription_requests', ['id' => $row->id, 'status' => 'approved']);
        $delivery = DB::table('telegram_deliveries')->first();
        $this->assertSame('sent', $delivery->status);
        $this->assertNull($delivery->encrypted_code);
        Http::assertSent(fn ($r) => (string) $r['chat_id'] === $u->telegram_id && str_contains($r['text'], 'Plus subscription'));
        Http::assertSent(fn ($r) => $r['parse_mode'] === 'HTML' && $r['reply_markup']['keyboard'][0][0] === '/account');
        $this->assertNull($u->fresh()->subscription_ends_at);
        $this->actingAs($admin)->post('/admin/requests/'.$row->id.'/approve')->assertRedirect();
        Http::assertSentCount(1);
        $this->actingAs($admin)->get('/admin')->assertInertia(fn (AssertableInertia $p) => $p->component('Admin')->has('stats')->where('stats.pending', 0)->has('deliveries', 1)->missing('deliveries.0.encrypted_code'));
        preg_match('/[a-f0-9]{48}/', Http::recorded()->first()[0]['text'], $match);
        app(Cinema::class)->activate($u, $match[0]);
        $this->assertSame('plus', $u->fresh()->plan);
    }

    public function test_failed_delivery_keeps_encrypted_code_and_retry_uses_same_code_only_once(): void
    {
        Http::fake(['api.telegram.org/*' => Http::sequence()->push(['ok' => false], 403)->push(['ok' => true])]);
        $u = $this->member();
        $a = $this->member();
        $a->forceFill(['is_admin' => true])->save();
        $this->actingAs($a)->post('/admin/users/'.$u->id.'/tokens', ['plan' => 'pro', 'months' => 1, 'send_telegram' => true])->assertRedirect()->assertSessionMissing('token');
        $delivery = DB::table('telegram_deliveries')->first();
        $this->assertSame('failed', $delivery->status);
        preg_match('/[a-f0-9]{48}/', Http::recorded()->first()[0]['text'], $match);
        $code = $match[0];
        $this->assertStringNotContainsString($code, $delivery->encrypted_code);
        $this->actingAs($a)->post('/admin/deliveries/'.$delivery->id.'/retry')->assertRedirect();
        Http::assertSent(fn ($r) => str_contains($r['text'], $code));
        $this->assertDatabaseHas('telegram_deliveries', ['id' => $delivery->id, 'status' => 'sent', 'attempts' => 2, 'encrypted_code' => null]);
        $this->actingAs($a)->post('/admin/deliveries/'.$delivery->id.'/retry')->assertRedirect();
        $this->assertSame(2, DB::table('telegram_deliveries')->value('attempts'));
    }

    public function test_plus_and_pro_can_add_bare_urls_with_automatic_icon_support_but_basic_cannot(): void
    {
        $u = $this->member();
        $t = app(Cinema::class)->issue($u, 'desktop');
        $this->withToken($t)->postJson('/api/sites', ['name' => 'Movies', 'url' => 'movies.example.com'])->assertForbidden();
        foreach (['plus', 'pro'] as $plan) {
            $u->forceFill(['plan' => $plan, 'subscription_ends_at' => now()->addMonth()])->save();
            $url = $plan.'.example.com';
            $this->withToken($t)->postJson('/api/sites', ['name' => 'Movies', 'url' => $url])->assertOk();
            $this->assertDatabaseHas('custom_sites', ['user_id' => $u->id, 'url' => 'https://'.$url]);
            $this->withToken($t)->getJson('/api/catalog')->assertOk()->assertJsonFragment(['url' => 'https://'.$url]);
            $this->withToken($t)->postJson('/api/sites', ['name' => 'Duplicate', 'url' => $url])->assertUnprocessable();
        }
        $this->withToken($t)->postJson('/api/sites', ['name' => 'Paid', 'url' => 'netflix.com'])->assertUnprocessable();
    }

    public function test_support_is_private_owner_replies_by_bot_and_repeated_delivery_is_not_duplicated(): void
    {
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true])]);
        $u = $this->member();
        $other = $this->member();
        $a = $this->member();
        $a->forceFill(['is_admin' => true])->save();
        $this->actingAs($u)->post('/support', ['subject' => 'Subscription help', 'message' => 'Please help me choose a plan.'])->assertRedirect();
        $ticket = DB::table('support_tickets')->first();
        $this->actingAs($other)->get('/dashboard')->assertInertia(fn (AssertableInertia $p) => $p->has('supportTickets', 0));
        $this->actingAs($u)->postJson('/admin/support/'.$ticket->id.'/reply', ['reply' => 'Choose Plus for personal websites.'])->assertForbidden();
        $this->actingAs($a)->post('/admin/support/'.$ticket->id.'/reply', ['reply' => 'Choose Plus for personal websites.'])->assertRedirect();
        $this->assertDatabaseHas('support_tickets', ['id' => $ticket->id, 'status' => 'replied']);
        Http::assertSent(fn ($r) => (string) $r['chat_id'] === $u->telegram_id && str_contains($r['text'], 'Choose Plus'));
        $this->actingAs($a)->post('/admin/support/'.$ticket->id.'/reply', ['reply' => 'Choose Plus for personal websites.'])->assertRedirect();
        Http::assertSentCount(1);
        $msg = ['message' => ['chat' => ['id' => $u->telegram_id, 'type' => 'private'], 'from' => ['id' => $u->telegram_id], 'text' => '/support My movie website is unavailable.']];
        $this->withHeader('X-Telegram-Bot-Api-Secret-Token', 'fake-secret')->postJson('/api/telegram/webhook', $msg)->assertOk();
        $this->assertDatabaseHas('support_tickets', ['user_id' => $u->id, 'message' => 'My movie website is unavailable.']);
    }
}
