<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TelegramDelivery
{
    public function __construct(private TelegramMessage $telegram) {}

    public function send(int $id): bool
    {
        $row = DB::table('telegram_deliveries')->find($id);
        abort_unless($row, 404);
        if ($row->status === 'sent') {
            return true;
        }
        $user = User::findOrFail($row->user_id);
        if (! config('cinema.telegram_token') || ! $user->telegram_id || ! $user->telegram_verified_at) {
            throw ValidationException::withMessages(['telegram' => 'The bot must be configured and the user must verify Telegram first.']);
        }
        $token = DB::table('cinema_tokens')->where('digest', $row->token_digest)->first();
        if (! $token || $token->consumed_at || now()->gte($token->expires_at)) {
            DB::table('telegram_deliveries')->where('id', $id)->update(['status' => 'expired', 'encrypted_code' => null, 'updated_at' => now()]);

            return false;
        }
        $claimed = DB::table('telegram_deliveries')->where('id', $id)->where(function ($q) {
            $q->whereIn('status', ['pending', 'failed'])->orWhere(fn ($q) => $q->where('status', 'sending')->where('updated_at', '<', now()->subMinutes(5)));
        })->update(['status' => 'sending', 'attempts' => DB::raw('attempts + 1'), 'updated_at' => now()]);
        if (! $claimed) {
            return false;
        }
        try {
            $code = Crypt::decryptString($row->encrypted_code);
            $message = '<b>CineStream · '.ucfirst($row->plan)." subscription</b>\n\nYour ".$row->months." month(s) plan is approved.\n\nActivation code:\n<code>".$code."</code>\n\nEnter it in your website account or desktop browser. The code is for your account only, works once, and expires in 7 days. Never share it.";
            if (! $this->telegram->send((string) $user->telegram_id, $message)) {
                throw new \RuntimeException('delivery');
            }
            DB::table('telegram_deliveries')->where('id', $id)->update(['status' => 'sent', 'encrypted_code' => null, 'error' => null, 'sent_at' => now(), 'updated_at' => now()]);

            return true;
        } catch (\Throwable $e) {
            DB::table('telegram_deliveries')->where('id', $id)->update(['status' => 'failed', 'error' => 'Telegram did not confirm delivery. Check bot configuration or ask the user to unblock the bot, then retry.', 'updated_at' => now()]);

            return false;
        }
    }
}
