<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Cinema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AccountController extends Controller
{
    public function dashboard(Request $r)
    {
        return Inertia::render('Dashboard', ['telegramAvailable' => (bool) (config('cinema.telegram_username') && config('cinema.telegram_token') && config('cinema.telegram_secret')), 'plans' => config('cinema.plans'), 'requestedPlan' => in_array($r->query('plan'), ['basic', 'plus', 'pro']) ? $r->query('plan') : 'plus', 'requestedMonths' => $r->query('months') == 12 ? 12 : 1, 'supportTickets' => DB::table('support_tickets')->where('user_id', $r->user()->id)->latest()->limit(10)->get(), 'requests' => DB::table('subscription_requests')->where('user_id', $r->user()->id)->latest()->limit(10)->get(), 'telegramBot' => config('cinema.telegram_username'), 'sites' => DB::table('custom_sites')->where('user_id', $r->user()->id)->get()]);
    }

    public function activate(Request $r, Cinema $c)
    {
        $d = $r->validate(['token' => 'required|string|max:100']);
        $c->activate($r->user(), $d['token']);

        return $this->done($r, 'Subscription activated.');
    }

    public function addSite(Request $r, Cinema $c)
    {
        $url = trim((string) $r->input('url'));
        if (! preg_match('/^[a-z][a-z0-9+.-]*:/i', $url)) {
            $url = 'https://'.$url;
        }
        if (str_starts_with(strtolower($url), 'http://')) {
            $url = 'https://'.substr($url, 7);
        }
        $r->merge(['url' => $url, 'name' => trim((string) $r->input('name'))]);
        $c->addSite($r->user(), $r->validate(['name' => 'required|string|max:80', 'url' => 'required|url:https|max:500']));

        return $this->done($r, 'Website added.');
    }

    public function removeSite(Request $r, int $site)
    {
        DB::table('custom_sites')->where('user_id', $r->user()->id)->where('id', $site)->delete();

        return $this->done($r, 'Website removed.');
    }

    public function favorite(Request $r, int $site)
    {
        $a = $r->user()->access();
        abort_unless($a['active'] && $a['custom_site_limit'] > 0, 403);
        $d = $r->validate(['favorite' => 'required|boolean']);
        DB::table('custom_sites')->where('user_id', $r->user()->id)->where('id', $site)->update($d);

        return $this->done($r, 'Favorite updated.');
    }

    public function linkTelegram(Request $r, Cinema $c)
    {
        abort_unless(config('cinema.telegram_username') && config('cinema.telegram_token') && config('cinema.telegram_secret'), 503, 'Telegram recovery has not been configured yet.');
        abort_if($r->user()->telegram_id, 409, 'Telegram is already linked.');
        $d = $r->validate(['password' => 'required|string']);
        abort_unless(Hash::check($d['password'], $r->user()->password), 422, 'Confirm your current password.');
        $token = DB::transaction(function () use ($r, $c) {
            DB::table('cinema_tokens')->where('user_id', $r->user()->id)->where('purpose', 'telegram')->update(['consumed_at' => now()]);

            return $c->issue($r->user(), 'telegram', [], 10);
        });
        $url = 'https://t.me/'.config('cinema.telegram_username').'?start='.$token;

        return $r->is('api/*') ? response()->json(['url' => $url]) : back()->with('telegram_link', $url);
    }

    public function verifyTelegram(Request $r, Cinema $c)
    {
        $d = $r->validate(['token' => 'required|string|max:100']);
        DB::transaction(function () use ($r, $c, $d) {
            $u = User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            abort_unless($u->telegram_id, 422, 'Open the bot and press Start first.');
            $c->consume($d['token'], 'telegram-confirmation', $u->id);
            $u->forceFill(['telegram_verified_at' => now()])->save();
        });

        return $this->done($r, 'Telegram verified. Your cinema is ready.');
    }

    public function requestSubscription(Request $r)
    {
        $d = $r->validate(['plan' => 'required|in:basic,plus,pro', 'months' => 'required|integer|in:1,12']);
        DB::transaction(function () use ($r, $d) {
            $u = User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            abort_if($u->suspended, 403, 'Your account is suspended.');
            if (! $u->telegram_verified_at) {
                throw ValidationException::withMessages(['plan' => 'Verify Telegram before requesting a subscription.']);
            }
            if (DB::table('subscription_requests')->where('user_id', $u->id)->where('status', 'pending')->exists()) {
                throw ValidationException::withMessages(['plan' => 'You already have a pending request. The owner will review it.']);
            }
            $plan = collect(config('cinema.plans'))->firstWhere('id', $d['plan']);
            DB::table('subscription_requests')->insert($d + ['user_id' => $u->id, 'amount' => $d['months'] == 12 ? $plan['yearly'] : $plan['monthly'], 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        });

        return $this->done($r, 'Request received. After payment approval, your activation code will arrive in Telegram.');
    }

    public function support(Request $r)
    {
        $d = $r->validate(['subject' => 'required|string|max:100', 'message' => 'required|string|max:2000']);
        DB::transaction(function () use ($r, $d) {
            $u = User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            if (DB::table('support_tickets')->where('user_id', $u->id)->whereIn('status', ['open', 'failed'])->count() >= 5) {
                throw ValidationException::withMessages(['message' => 'You have five open support requests. Please wait for a reply.']);
            }
            DB::table('support_tickets')->insert($d + ['user_id' => $u->id, 'status' => 'open', 'created_at' => now(), 'updated_at' => now()]);
        });

        return $this->done($r, 'Your support message was sent to the owner. Replies appear here and in your verified Telegram chat.');
    }

    private function done(Request $r, string $message)
    {
        return $r->is('api/*') ? response()->json(['ok' => true, 'access' => $r->user()->fresh()->access()]) : back()->with('message', $message);
    }
}
