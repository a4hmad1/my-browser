<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Cinema;
use App\Services\TelegramDelivery;
use App\Services\TelegramMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AdminController extends Controller
{
    public function index(Request $r)
    {
        $filters = $r->validate(['search' => 'nullable|string|max:100', 'status' => 'nullable|in:all,active,expired,suspended,telegram']);
        $search = $filters['search'] ?? '';
        $status = $filters['status'] ?? 'all';
        $query = User::query()->when($search, fn ($q) => $q->where(fn ($q) => $q->where('email', 'like', "%$search%")->orWhere('name', 'like', "%$search%")->orWhere('telegram_username', 'like', "%$search%")));
        if ($status === 'suspended') {
            $query->where('suspended', true);
        }
        if ($status === 'telegram') {
            $query->whereNotNull('telegram_verified_at');
        }
        if ($status === 'active') {
            $query->where('suspended', false)->where(fn ($q) => $q->where('trial_ends_at', '>', now())->orWhere('subscription_ends_at', '>', now()))->where(function ($q) {
                if (config('cinema.telegram_token') && config('cinema.telegram_username') && config('cinema.telegram_secret')) {
                    $q->whereNotNull('telegram_verified_at')->orWhere('is_admin', true);
                }
            });
        }
        if ($status === 'expired') {
            $query->where(fn ($q) => $q->whereNull('trial_ends_at')->orWhere('trial_ends_at', '<=', now()))->where(fn ($q) => $q->whereNull('subscription_ends_at')->orWhere('subscription_ends_at', '<=', now()));
        }
        $daily = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = now()->subDays($i);
            $daily[] = ['label' => $day->format('D'), 'count' => User::whereDate('created_at', $day->toDateString())->count()];
        }

        return Inertia::render('Admin', [
            'users' => $query->latest()->paginate(15)->withQueryString()->through(fn ($u) => array_merge($u->only('id', 'name', 'email', 'telegram_username', 'is_admin', 'created_at'), ['access' => $u->access()])),
            'search' => $search, 'status' => $status, 'plans' => config('cinema.plans'),
            'stats' => ['users' => User::count(), 'paid' => User::where('subscription_ends_at', '>', now())->where('suspended', false)->count(), 'trials' => User::where('trial_ends_at', '>', now())->where(fn ($q) => $q->whereNull('subscription_ends_at')->orWhere('subscription_ends_at', '<=', now()))->count(), 'suspended' => User::where('suspended', true)->count(), 'verified' => User::whereNotNull('telegram_verified_at')->count(), 'pending' => DB::table('subscription_requests')->where('status', 'pending')->count()],
            'daily' => $daily, 'telegramAvailable' => (bool) (config('cinema.telegram_token') && config('cinema.telegram_username') && config('cinema.telegram_secret')),
            'requests' => DB::table('subscription_requests as r')->join('users as u', 'u.id', '=', 'r.user_id')->where('r.status', 'pending')->orderBy('r.created_at')->limit(50)->get(['r.*', 'u.name', 'u.email', 'u.telegram_username']),
            'deliveries' => DB::table('telegram_deliveries as d')->join('users as u', 'u.id', '=', 'd.user_id')->latest('d.created_at')->limit(30)->get(['d.id', 'd.user_id', 'd.plan', 'd.months', 'd.status', 'd.attempts', 'd.error', 'd.sent_at', 'd.created_at', 'u.name', 'u.telegram_username']),
            'supportTickets' => DB::table('support_tickets as t')->join('users as u', 'u.id', '=', 't.user_id')->latest('t.created_at')->limit(30)->get(['t.*', 'u.name', 'u.telegram_username', 'u.telegram_verified_at']), 'events' => DB::table('admin_events as e')->join('users as u', 'u.id', '=', 'e.user_id')->latest('e.created_at')->limit(20)->get(['e.id', 'e.action', 'e.created_at', 'u.name'])]);
    }

    public function status(Request $r, User $user)
    {
        $d = $r->validate(['suspended' => 'required|boolean']);
        abort_if($user->is_admin, 422, 'Administrator accounts cannot be changed here.');
        DB::transaction(function () use ($r, $user, $d) {
            $user->forceFill($d)->save();
            $this->audit($r, $user, $d['suspended'] ? 'suspend' : 'approve');
        });

        return back()->with('message', 'Account status updated.');
    }

    public function issue(Request $r, User $user, Cinema $c, TelegramDelivery $delivery)
    {
        $d = $r->validate(['plan' => 'required|in:basic,plus,pro', 'months' => 'required|integer|in:1,12', 'send_telegram' => 'sometimes|boolean']);
        if ($d['send_telegram'] ?? false) {
            $id = DB::transaction(fn () => $this->prepareDelivery($r, $user, $c, $d));

            return back()->with('message', $delivery->send($id) ? 'Activation code delivered to the user in Telegram.' : 'Code saved. Telegram delivery failed; retry from delivery history.');
        }
        $token = DB::transaction(function () use ($r, $user, $c, $d) {
            $this->audit($r, $user, 'issue-subscription', $d);

            return $c->issue($user, 'subscription', ['plan' => $d['plan'], 'months' => $d['months']], 10080);
        });

        return back()->with('token', $token)->with('message', 'Copy this code now. It is bound to '.$user->email.', valid for 7 days, and can be used once.');
    }

    private function prepareDelivery(Request $r, User $user, Cinema $c, array $d, ?int $requestId = null): int
    {
        $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
        if (! $user->telegram_id || ! $user->telegram_verified_at || ! config('cinema.telegram_token') || ! config('cinema.telegram_username') || ! config('cinema.telegram_secret')) {
            throw ValidationException::withMessages(['telegram' => 'Configure the bot and ask this user to verify Telegram before sending a code.']);
        }
        abort_if($user->suspended, 422, 'Approve the account before issuing a subscription.');
        $code = $c->issue($user, 'subscription', ['plan' => $d['plan'], 'months' => $d['months']], 10080);
        $id = DB::table('telegram_deliveries')->insertGetId(['user_id' => $user->id, 'admin_id' => $r->user()->id, 'request_id' => $requestId, 'plan' => $d['plan'], 'months' => $d['months'], 'token_digest' => hash('sha256', $code), 'encrypted_code' => Crypt::encryptString($code), 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);
        $this->audit($r, $user, 'send-subscription', ['plan' => $d['plan'], 'months' => $d['months'], 'delivery_id' => $id]);

        return $id;
    }

    public function approveRequest(Request $r, int $requestId, Cinema $c, TelegramDelivery $delivery)
    {
        $id = DB::transaction(function () use ($r, $requestId, $c) {
            $row = DB::table('subscription_requests')->where('id', $requestId)->lockForUpdate()->first();
            abort_unless($row, 404);
            if ($row->status === 'approved') {
                return DB::table('telegram_deliveries')->where('request_id', $row->id)->value('id');
            }
            abort_unless($row->status === 'pending', 422, 'This request is closed.');
            $id = $this->prepareDelivery($r, User::findOrFail($row->user_id), $c, ['plan' => $row->plan, 'months' => $row->months], $row->id);
            DB::table('subscription_requests')->where('id', $row->id)->update(['status' => 'approved', 'updated_at' => now()]);

            return $id;
        });

        return back()->with('message', $delivery->send($id) ? 'Request approved. Code delivered by Telegram.' : 'Request approved. Delivery failed; retry the saved code below.');
    }

    public function declineRequest(Request $r, int $requestId)
    {
        DB::transaction(function () use ($r, $requestId) {
            $row = DB::table('subscription_requests')->where('id', $requestId)->lockForUpdate()->first();
            abort_unless($row, 404);
            abort_unless($row->status === 'pending', 422);
            DB::table('subscription_requests')->where('id', $row->id)->update(['status' => 'declined', 'updated_at' => now()]);
            $this->audit($r, User::findOrFail($row->user_id), 'decline-request', ['request_id' => $row->id]);
        });

        return back()->with('message', 'Request declined.');
    }

    public function retryDelivery(Request $r, int $delivery, TelegramDelivery $service)
    {
        $row = DB::table('telegram_deliveries')->find($delivery);
        abort_unless($row, 404);
        $this->audit($r, User::findOrFail($row->user_id), 'retry-delivery', ['delivery_id' => $delivery]);

        return back()->with('message', $service->send($delivery) ? 'Activation code delivered.' : 'Delivery could not be confirmed. See its status below.');
    }

    public function replySupport(Request $r, int $ticket, TelegramMessage $telegram)
    {
        $d = $r->validate(['reply' => 'required|string|max:2000']);
        $row = DB::transaction(function () use ($ticket, $d) {
            $row = DB::table('support_tickets')->where('id', $ticket)->lockForUpdate()->first();
            abort_unless($row, 404);
            if ($row->status === 'replied' && $row->reply === $d['reply']) {
                return $row;
            }
            abort_if($row->status === 'sending' && now()->subMinutes(5)->lt($row->updated_at), 409, 'A reply is already being sent.');
            DB::table('support_tickets')->where('id', $ticket)->update(['reply' => $d['reply'], 'status' => 'sending', 'updated_at' => now()]);

            return $row;
        });
        if ($row->status === 'replied' && $row->reply === $d['reply']) {
            return back()->with('message', 'This reply was already delivered.');
        }
        $u = User::findOrFail($row->user_id);
        $sent = false;
        if ($u->telegram_id && $u->telegram_verified_at && config('cinema.telegram_token')) {
            $sent = $telegram->send((string) $u->telegram_id, '<b>CineStream · Support #'.$ticket."</b>\n\n".TelegramMessage::escape($d['reply'])."\n\nYou can also read this reply in your website account.");
        }
        DB::table('support_tickets')->where('id', $ticket)->update(['status' => $sent ? 'replied' : 'failed', 'updated_at' => now()]);
        $this->audit($r, $u, 'support-reply', ['ticket_id' => $ticket, 'telegram_sent' => $sent]);

        return back()->with('message', $sent ? 'Reply delivered in Telegram and saved in the user account.' : 'Reply saved in the user account. Telegram was unavailable; you can resend after the user verifies or unblocks the bot.');
    }

    private function audit(Request $r, User $u, string $action, array $details = []): void
    {
        DB::table('admin_events')->insert(['admin_id' => $r->user()->id, 'user_id' => $u->id, 'action' => $action, 'details' => json_encode($details), 'created_at' => now(), 'updated_at' => now()]);
    }
}
