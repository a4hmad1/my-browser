<?php

namespace App\Console\Commands;

use App\Http\Controllers\TelegramController;
use App\Services\Cinema;
use App\Services\TelegramMessage;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class CinemaTelegramPoll extends Command
{
    protected $signature = 'cinema:telegram-poll {--once : Process one polling batch}';

    protected $description = 'Run the Telegram bot locally until a public webhook is configured';

    public function handle(Cinema $cinema): int
    {
        if (! app()->environment('local')) {
            $this->error('Local polling is available only in the local environment. Use an HTTPS webhook in production.');

            return self::FAILURE;
        }
        $token = config('cinema.telegram_token');
        $secret = config('cinema.telegram_secret');
        if (! $token || ! $secret) {
            $this->error('Configure the bot token and webhook secret in .env.');

            return self::FAILURE;
        }
        $lock = fopen(storage_path('framework/telegram-poll.lock'), 'c');
        if (! $lock || ! flock($lock, LOCK_EX | LOCK_NB)) {
            $this->error('A local polling process is already running.');

            return self::FAILURE;
        }
        $base = 'https://api.telegram.org/bot'.$token;
        try {
            $info = Http::timeout(10)->get($base.'/getWebhookInfo');
            if (! $info->successful() || ! $info->json('ok')) {
                throw new \RuntimeException;
            }
            if ($info->json('result.url')) {
                $this->error('This bot already has a webhook. Existing delivery was left unchanged.');

                return self::FAILURE;
            }
        } catch (\Throwable $e) {
            $this->error('Could not verify the bot connection.');

            return self::FAILURE;
        }
        $file = storage_path('framework/telegram-offset');
        $offset = is_file($file) ? (int) file_get_contents($file) : 0;
        $this->info('Local Telegram bot is listening. Press Ctrl+C to stop.');
        do {
            try {
                $response = Http::timeout(35)->post($base.'/getUpdates', ['offset' => $offset, 'timeout' => $this->option('once') ? 0 : 25, 'allowed_updates' => ['message']]);
                if (! $response->successful() || ! $response->json('ok')) {
                    throw new \RuntimeException;
                }
                foreach ($response->json('result', []) as $update) {
                    $request = Request::create('/api/telegram/webhook', 'POST', $update, [], [], ['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN' => $secret]);
                    $reply = app(TelegramController::class)($request, $cinema, app(TelegramMessage::class));
                    if ($reply->getStatusCode() >= 400) {
                        throw new \RuntimeException;
                    }
                    $offset = $update['update_id'] + 1;
                    file_put_contents($file, (string) $offset, LOCK_EX);
                    chmod($file, 0600);
                }
            } catch (\Throwable $e) {
                $this->warn('Telegram polling or reply failed. Retrying without exposing bot credentials.');
                if ($this->option('once')) {
                    return self::FAILURE;
                }
                sleep(3);
            }
        } while (! $this->option('once'));

        return self::SUCCESS;
    }
}
