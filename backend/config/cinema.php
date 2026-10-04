<?php

return [
    'plans' => [
        ['id' => 'basic', 'name' => 'Basic', 'monthly' => 5000, 'yearly' => 57000, 'sites' => 0, 'features' => ['Curated movie directory', 'Ad & popup protection', 'Private browsing session', 'Theater & fullscreen']],
        ['id' => 'plus', 'name' => 'Plus', 'monthly' => 10000, 'yearly' => 114000, 'sites' => 10, 'features' => ['Everything in Basic', '10 personal movie websites', 'Favorite personal websites']],
        ['id' => 'pro', 'name' => 'Pro', 'monthly' => 20000, 'yearly' => 228000, 'sites' => 100, 'features' => ['Everything in Plus', '100 personal movie websites', 'Search your expanded directory']],
    ],
    'downloads' => ['windows' => env('DOWNLOAD_WINDOWS_URL'), 'linux' => env('DOWNLOAD_LINUX_URL'), 'deb' => env('DOWNLOAD_DEB_URL')],
    'preview_downloads' => [
        'windows' => 'CineStream-1.1.0-preview-win-x64-portable.exe',
        'linux' => 'CineStream-1.1.0-preview-linux-x86_64.AppImage',
        'deb' => 'CineStream-1.1.0-preview-linux-amd64.deb',
    ],
    'telegram_token' => env('TELEGRAM_BOT_TOKEN'), 'telegram_username' => env('TELEGRAM_BOT_USERNAME'), 'telegram_secret' => env('TELEGRAM_WEBHOOK_SECRET'),
];
