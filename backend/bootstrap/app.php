<?php

use App\Http\Middleware\Admin;
use App\Http\Middleware\DesktopAuth;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', api: __DIR__.'/../routes/api.php', commands: __DIR__.'/../routes/console.php', health: '/up')
    ->withMiddleware(function (Middleware $m): void {
        if (getenv('VERCEL')) {
            $m->trustProxies(at: '*', headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO);
        }
        $m->web(append: [HandleInertiaRequests::class]);
        $m->append(SecurityHeaders::class);
        $m->alias(['desktop' => DesktopAuth::class, 'admin' => Admin::class]);
    })
    ->withExceptions(function (Exceptions $e): void {
        $e->shouldRenderJsonWhen(fn (Request $r) => $r->is('api/*') || $r->expectsJson());
    })->create();
