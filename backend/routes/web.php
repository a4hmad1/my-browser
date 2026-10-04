<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Services\Cinema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('Home', [
    'plans' => config('cinema.plans'),
    'downloads' => collect(config('cinema.downloads'))->map(fn ($url, $platform) => (bool) $url || (bool) Cinema::previewDownload($platform))->all(),
    'releaseLabel' => app()->environment('local') ? 'Local preview · requires localhost:4000' : 'v1.1.0',
    'sources' => json_decode(file_get_contents(resource_path('catalog.json')), true)['sites'],
]))->name('home');
Route::middleware('guest')->group(function () {
    Route::get('/login', fn () => Inertia::render('Auth', ['mode' => 'login']))->name('login');
    Route::get('/register', fn () => Inertia::render('Auth', ['mode' => 'register']));
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
});
Route::get('/reset-password', fn () => Inertia::render('Auth', ['mode' => 'reset']));
Route::post('/reset-password', [AuthController::class, 'reset'])->middleware('throttle:reset');
Route::get('/owner-login', fn (Request $r) => $r->user()?->is_admin && ! $r->user()->suspended ? redirect('/admin') : Inertia::render('Auth', ['mode' => 'owner']));
Route::post('/owner-login', [AuthController::class, 'ownerLogin'])->middleware('throttle:login');
Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/dashboard', [AccountController::class, 'dashboard']);
    Route::post('/subscription/activate', [AccountController::class, 'activate'])->middleware('throttle:activation');
    Route::post('/telegram/verify', [AccountController::class, 'verifyTelegram'])->middleware('throttle:activation');
    Route::post('/subscription/request', [AccountController::class, 'requestSubscription'])->middleware('throttle:6,1');
    Route::post('/telegram/link', [AccountController::class, 'linkTelegram'])->middleware('throttle:6,1');
    Route::post('/support', [AccountController::class, 'support'])->middleware('throttle:5,1');
    Route::post('/sites', [AccountController::class, 'addSite']);
    Route::delete('/sites/{site}', [AccountController::class, 'removeSite']);
    Route::patch('/sites/{site}', [AccountController::class, 'favorite']);
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::post('/deliveries/{delivery}/retry', [AdminController::class, 'retryDelivery'])->middleware('throttle:6,1');
        Route::post('/requests/{requestId}/approve', [AdminController::class, 'approveRequest'])->middleware('throttle:6,1');
        Route::post('/requests/{requestId}/decline', [AdminController::class, 'declineRequest']);
        Route::post('/support/{ticket}/reply', [AdminController::class, 'replySupport'])->middleware('throttle:10,1');
        Route::get('/', [AdminController::class, 'index']);
        Route::patch('/users/{user}', [AdminController::class, 'status']);
        Route::post('/users/{user}/tokens', [AdminController::class, 'issue']);
    });
});
Route::get('/download/{platform}', function (string $platform) {
    abort_unless(in_array($platform, ['windows', 'linux', 'deb']), 404);
    $url = config('cinema.downloads.'.$platform);
    if (! $url && ($file = Cinema::previewDownload($platform))) {
        return response()->download($file, null, ['Cache-Control' => 'no-store']);
    }
    abort_unless($url && filter_var($url, FILTER_VALIDATE_URL) && parse_url($url, PHP_URL_SCHEME) === 'https' && ! parse_url($url, PHP_URL_USER) && ! parse_url($url, PHP_URL_PASS), 503, 'This release has not been published yet.');

    return redirect()->away($url);
})->middleware('throttle:30,1');
