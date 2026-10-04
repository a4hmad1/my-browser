<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        foreach (['login' => 10, 'register' => 5, 'reset' => 5, 'activation' => 10] as $name => $count) {
            RateLimiter::for($name, fn (Request $r) => [Limit::perMinute($count)->by($name.':'.$r->ip()), Limit::perMinute($count)->by($name.':'.strtolower($r->input('email', (string) ($r->user()?->id ?? $r->ip()))))]);
        }
    }
}
