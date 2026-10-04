<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'telegram_username'];

    protected $hidden = ['password', 'remember_token', 'telegram_id'];

    protected function casts(): array
    {
        return ['telegram_verified_at' => 'datetime', 'password' => 'hashed', 'is_admin' => 'boolean', 'suspended' => 'boolean', 'trial_ends_at' => 'datetime', 'subscription_ends_at' => 'datetime'];
    }

    public function access(): array
    {
        $paid = $this->subscription_ends_at?->isFuture() && in_array($this->plan, ['basic', 'plus', 'pro']);
        $trial = $this->trial_ends_at?->isFuture();
        $plan = $paid ? $this->plan : 'basic';

        $telegramRequired = ! $this->is_admin && (app()->environment('production') || (config('cinema.telegram_token') && config('cinema.telegram_username') && config('cinema.telegram_secret'))) && ! $this->telegram_verified_at;

        return ['active' => ! $this->suspended && ! $telegramRequired && ($paid || $trial), 'telegram_required' => (bool) $telegramRequired, 'telegram_verified' => (bool) $this->telegram_verified_at, 'suspended' => $this->suspended,
            'plan' => $plan, 'trial' => ! $paid && (bool) $trial, 'ends_at' => ($paid ? $this->subscription_ends_at : $this->trial_ends_at)?->toIso8601String(),
            'custom_site_limit' => ['basic' => 0, 'plus' => 10, 'pro' => 100][$plan], 'telegram_linked' => (bool) $this->telegram_id];
    }
}
