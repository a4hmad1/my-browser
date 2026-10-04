<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Cinema;
use App\Services\TelegramMessage;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class TelegramController extends Controller
{
    public function __invoke(Request $r, Cinema $c, TelegramMessage $telegram)
    {
        $secret = config('cinema.telegram_secret');
        abort_unless($secret && hash_equals($secret, $r->header('X-Telegram-Bot-Api-Secret-Token', '')), 403);
        $m = $r->input('message', []);
        $chat = (string) ($m['chat']['id'] ?? '');
        $sender = (string) ($m['from']['id'] ?? '');
        if (($m['from']['is_bot'] ?? false) || ! $chat || $chat !== $sender || ($m['chat']['type'] ?? '') !== 'private') {
            return response()->json(['ok' => true]);
        }
        if (RateLimiter::tooManyAttempts('telegram:'.$chat, 5)) {
            return response()->json(['ok' => true]);
        }
        RateLimiter::hit('telegram:'.$chat, 600);
        $text = $m['text'] ?? '';
        $reply = User::where('telegram_id', $chat)->exists()
            ? "<b>CineStream · Help</b>\n\nUse the command buttons below:\n/account — membership and verification\n/reset — password recovery\n/support your message — contact the owner"
            : "<b>CineStream account</b>\n\nSign in to the website and link this Telegram account from your dashboard. Once linked, use /account for membership, /reset for password recovery, or /support for help.";
        if (preg_match('/^\/start(?:@\w+)? ([a-f0-9]{48})$/', $text, $match)) {
            try {
                DB::transaction(function () use ($match, $c, $chat, $m) {
                    $row = $c->consume($match[1], 'telegram');
                    $u = User::whereKey($row->user_id)->lockForUpdate()->firstOrFail();
                    abort_if($u->telegram_id, 409);
                    if ($u->telegram_username && strtolower($m['from']['username'] ?? '') !== $u->telegram_username) {
                        throw ValidationException::withMessages(['telegram' => 'Username mismatch.']);
                    }
                    $u->forceFill(['telegram_id' => $chat])->save();
                });
                $u = User::where('telegram_id', $chat)->firstOrFail();
                $code = $c->issue($u, 'telegram-confirmation', [], 10);
                $reply = '<b>CineStream · Verify your account</b>'."\n\nHello, ".TelegramMessage::escape($u->name).". Your Telegram account is linked.\n\nVerification code:\n<code>".$code."</code>\n\nEnter this code in your website account or desktop browser. It expires in 10 minutes and works once.\n\nSubscription codes will arrive in this private chat after the owner approves your request.";
            } catch (ValidationException|QueryException|HttpException $e) {
                $reply = "<b>Link not completed</b>\n\nThe link may have expired, been used already, or belong to another Telegram username. Sign in to your website account to get a fresh link.";
            }
        } elseif (preg_match('/^\/(?:account|start)(?:@\w+)?$/', $text)) {
            $u = User::where('telegram_id', $chat)->first();
            if ($u) {
                if (! $u->telegram_verified_at) {
                    $code = DB::transaction(function () use ($u, $c) {
                        DB::table('cinema_tokens')->where('user_id', $u->id)->where('purpose', 'telegram-confirmation')->update(['consumed_at' => now()]);

                        return $c->issue($u, 'telegram-confirmation', [], 10);
                    });
                    $reply = "<b>CineStream · Verification code</b>\n\n<code>".$code."</code>\n\nEnter it in your website account or desktop browser within 10 minutes. This code works once.";
                } else {
                    $a = $u->access();
                    $reply = '<b>CineStream · Your account</b>'."\n\n".TelegramMessage::escape($u->name)."\nPlan: <b>".TelegramMessage::escape(ucfirst($a['plan']))."</b>\nStatus: <b>".($a['active'] ? 'Active' : 'Inactive')."</b>\nAccess ends: ".TelegramMessage::escape((string) ($a['ends_at'] ?? 'No subscription'))."\n\nRequest a plan from your website account. Once approved, your activation code will arrive here.";
                }
            }
        } elseif (preg_match('/^\/support(?:@\w+)?(?: (.+))?$/s', $text, $match)) {
            $u = User::where('telegram_id', $chat)->first();
            if ($u && $u->telegram_verified_at) {
                $body = trim($match[1] ?? '');
                if ($body === '') {
                    $reply = "<b>CineStream · Support</b>\n\nSend <code>/support</code> followed by your message. Example:\n<code>/support I need help with my subscription.</code>";
                } elseif (mb_strlen($body) > 2000) {
                    $reply = "<b>CineStream · Support</b>\n\nPlease keep your message under 2,000 characters.";
                } else {
                    $id = DB::transaction(function () use ($u, $body) {
                        User::whereKey($u->id)->lockForUpdate()->firstOrFail();
                        if (DB::table('support_tickets')->where('user_id', $u->id)->whereIn('status', ['open', 'failed'])->count() >= 5) {
                            return null;
                        }

                        return DB::table('support_tickets')->insertGetId(['user_id' => $u->id, 'subject' => 'Telegram support', 'message' => $body, 'status' => 'open', 'created_at' => now(), 'updated_at' => now()]);
                    });
                    $reply = $id ? '<b>CineStream · Support request #'.$id."</b>\n\nYour message is with the owner. A reply will appear here and in your account." : "<b>CineStream · Support</b>\n\nYou already have five open requests. Please wait for the owner to reply.";
                }
            }
        } elseif (preg_match('/^\/reset(?:@\w+)?$/', $text)) {
            $u = User::where('telegram_id', $chat)->first();
            if ($u) {
                $code = DB::transaction(function () use ($u, $c) {
                    DB::table('cinema_tokens')->where('user_id', $u->id)->where('purpose', 'reset')->update(['consumed_at' => now()]);

                    return $c->issue($u, 'reset', [], 10);
                });
                $reply = "<b>CineStream · Password reset</b>\n\nYour one-time reset code:\n<code>".$code."</code>\n\nEnter it in the website reset form within 10 minutes. Never share this code.";
            }
        }
        if (! $telegram->send($chat, $reply)) {
            return response()->json(['ok' => false], 503);
        }

        return response()->json(['ok' => true]);
    }
}
