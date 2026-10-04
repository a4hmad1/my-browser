<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('cinema:admin {email}', function () {
    $u = User::where('email', $this->argument('email'))->first();
    if (! $u) {
        $this->error('Register this account first.');

        return 1;
    }
    $u->forceFill(['is_admin' => true, 'suspended' => false])->save();
    $this->info('Administrator access granted.');
});
Schedule::call(fn () => DB::table('cinema_tokens')->where('expires_at', '<', now()->subDay())->delete())->daily();
