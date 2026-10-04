<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Cinema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $r, Cinema $cinema)
    {
        $r->merge(['telegram_username' => strtolower(ltrim((string) $r->input('telegram_username'), '@'))]);
        $d = $r->validate(['telegram_username' => ['required', 'regex:/^[a-z][a-z0-9_]{4,31}$/', 'unique:users,telegram_username'], 'name' => 'required|string|max:80', 'email' => 'required|email|max:254|unique:users', 'password' => ['required', 'confirmed', Password::min(10)]]);
        $u = User::create($d);
        $u->forceFill(['trial_ends_at' => now()->addDay()])->save();

        return $this->signedIn($r, $u, $cinema);
    }

    public function login(Request $r, Cinema $cinema)
    {
        $d = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        $u = User::where('email', $d['email'])->first();
        if (! $u || ! Hash::check($d['password'], $u->password)) {
            throw ValidationException::withMessages(['email' => 'The account details are incorrect.']);
        }

        return $this->signedIn($r, $u, $cinema);
    }

    public function ownerLogin(Request $r)
    {
        $d = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        $u = User::where('email', $d['email'])->first();
        if (! $u || ! Hash::check($d['password'], $u->password) || ! $u->is_admin || $u->suspended) {
            throw ValidationException::withMessages(['email' => 'The owner account details are incorrect.']);
        }

        Auth::login($u);
        $r->session()->regenerate();

        return redirect('/admin');
    }

    private function signedIn(Request $r, User $u, Cinema $cinema)
    {
        $telegramUrl = null;
        if (! $u->telegram_id && config('cinema.telegram_token') && config('cinema.telegram_username') && config('cinema.telegram_secret')) {
            $link = DB::transaction(function () use ($u, $cinema) {
                DB::table('cinema_tokens')->where('user_id', $u->id)->where('purpose', 'telegram')->update(['consumed_at' => now()]);

                return $cinema->issue($u, 'telegram', [], 10);
            });
            $telegramUrl = 'https://t.me/'.config('cinema.telegram_username').'?start='.$link;
        }
        if ($r->is('api/*')) {
            $token = $cinema->issue($u, 'desktop', [], 60 * 24 * 30);

            return response()->json(['token' => $token, 'user' => $u->only('id', 'name', 'email'), 'access' => $u->access(), 'telegram_url' => $telegramUrl]);
        }
        Auth::login($u);
        $r->session()->regenerate();

        return redirect('/dashboard')->with('telegram_link', $telegramUrl);
    }

    public function logout(Request $r)
    {
        if ($r->is('api/*')) {
            DB::table('cinema_tokens')->where('digest', hash('sha256', $r->bearerToken()))->update(['consumed_at' => now()]);

            return response()->json(['ok' => true]);
        }
        Auth::logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return redirect('/');
    }

    public function reset(Request $r, Cinema $cinema)
    {
        $d = $r->validate(['email' => 'required|email', 'token' => 'required|string|max:100', 'password' => ['required', 'confirmed', Password::min(10)]]);
        DB::transaction(function () use ($d, $cinema) {
            $u = User::where('email', $d['email'])->lockForUpdate()->first();
            if (! $u) {
                throw ValidationException::withMessages(['token' => 'This reset code is invalid.']);
            }
            $cinema->consume($d['token'], 'reset', $u->id);
            $u->forceFill(['password' => $d['password'], 'remember_token' => null])->save();
            DB::table('cinema_tokens')->where('user_id', $u->id)->whereIn('purpose', ['desktop', 'reset', 'telegram'])->update(['consumed_at' => now()]);
            DB::table('sessions')->where('user_id', $u->id)->delete();
        });

        return $r->is('api/*') ? response()->json(['ok' => true]) : redirect('/login')->with('message', 'Password updated. Sign in again.');
    }
}
