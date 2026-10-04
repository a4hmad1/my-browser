<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class TelegramMessage
{
    public static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public function send(string $chatId, string $message): bool
    {
        try {
            $response = Http::timeout(10)->post('https://api.telegram.org/bot'.config('cinema.telegram_token').'/sendMessage', [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'HTML',
                'reply_markup' => [
                    'keyboard' => [['/account', '/reset'], ['/support']],
                    'resize_keyboard' => true,
                    'is_persistent' => true,
                    'input_field_placeholder' => 'CineStream commands',
                ],
            ]);

            return $response->successful() && $response->json('ok') === true;
        } catch (\Throwable $exception) {
            return false;
        }
    }
}
