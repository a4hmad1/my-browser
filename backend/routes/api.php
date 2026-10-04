<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\ActivationCodeController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\TelegramController;
use App\Services\Cinema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/activation-codes/activate', [ActivationCodeController::class, 'activate'])->middleware('throttle:60,1');
Route::get('/activation-codes/check/{code}', [ActivationCodeController::class, 'check'])->middleware('throttle:60,1');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/reset-password', [AuthController::class, 'reset'])->middleware('throttle:reset');
Route::post('/telegram/webhook', TelegramController::class)->middleware('throttle:120,1');
Route::middleware(['desktop', 'throttle:120,1'])->group(function () {
    Route::get('/account', fn (Request $r) => ['user' => $r->user()->only('id', 'name', 'email'), 'access' => $r->user()->access(), 'telegram_bot' => config('cinema.telegram_username'), 'plans' => config('cinema.plans')]);
    Route::get('/catalog', fn (Request $r, Cinema $c) => $c->catalog($r->user()));
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/subscription/activate', [AccountController::class, 'activate'])->middleware('throttle:activation');
    Route::post('/sites', [AccountController::class, 'addSite']);
    Route::delete('/sites/{site}', [AccountController::class, 'removeSite']);
    Route::patch('/sites/{site}', [AccountController::class, 'favorite']);
    Route::post('/telegram/verify', [AccountController::class, 'verifyTelegram'])->middleware('throttle:activation');
    Route::post('/subscription/request', [AccountController::class, 'requestSubscription'])->middleware('throttle:6,1');
    Route::post('/telegram/link', [AccountController::class, 'linkTelegram'])->middleware('throttle:6,1');
});
