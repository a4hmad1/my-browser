<?php

use Illuminate\Http\Request;

// Vercel has a read-only deployment filesystem. Only disposable view files live in /tmp.
$storage = sys_get_temp_dir().'/cinestream';
foreach (['framework/views', 'framework/cache', 'framework/sessions', 'logs'] as $directory) {
    $path = $storage.'/'.$directory;
    if (! is_dir($path)) {
        mkdir($path, 0700, true);
    }
}
if (getenv('VERCEL')) {
    $_SERVER['HTTPS'] = 'on';
}
define('LARAVEL_START', microtime(true));
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->useStoragePath($storage);
$app->handleRequest(Request::capture());
