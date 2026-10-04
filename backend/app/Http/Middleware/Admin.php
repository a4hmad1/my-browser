<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class Admin
{
    public function handle(Request $r, Closure $next)
    {
        if (! $r->user()?->is_admin || $r->user()->suspended) {
            if ($r->isMethod('GET') && $r->is('admin')) {
                return redirect('/owner-login');
            }

            abort(403);
        }

        return $next($r);
    }
}
