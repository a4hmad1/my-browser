<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $r): array
    {
        return array_merge(parent::share($r), [
            'user' => fn () => $r->user()?->only('id', 'name', 'email', 'is_admin', 'telegram_username'),
            'access' => fn () => $r->user()?->access(),
            'flash' => fn () => ['message' => $r->session()->get('message'), 'token' => $r->session()->get('token'), 'telegram_link' => $r->session()->get('telegram_link')],
        ]);
    }
}
