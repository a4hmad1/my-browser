<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DesktopAuth
{
    public function handle(Request $r, Closure $next)
    {
        $token = $r->bearerToken();
        abort_unless($token, 401);
        $row = DB::table('cinema_tokens')->where('digest', hash('sha256', $token))->where('purpose', 'desktop')->whereNull('consumed_at')->where('expires_at', '>', now())->first();
        abort_unless($row, 401);
        $user = User::findOrFail($row->user_id);
        $r->setUserResolver(fn () => $user);

        return $next($r);
    }
}
