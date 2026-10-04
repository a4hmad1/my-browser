<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class Cinema
{
    public static function previewDownload(string $platform): ?string
    {
        if (! app()->environment('local')) {
            return null;
        }
        $manifest = base_path('../dist/preview/releases.json');
        $releases = is_file($manifest) ? json_decode(file_get_contents($manifest), true) : [];
        $release = $releases['files'][$platform] ?? null;
        $filename = config('cinema.preview_downloads.'.$platform);
        $file = base_path('../dist/preview/'.$filename);
        if ($filename && ($release['filename'] ?? null) === $filename && is_file($file) && filesize($file) === ($release['size'] ?? null)) {
            return $file;
        }

        return null;
    }

    public function issue(User $user, string $purpose, array $extra = [], int $minutes = 30): string
    {
        $token = bin2hex(random_bytes(24));
        DB::table('cinema_tokens')->insert(array_merge(['user_id' => $user->id, 'purpose' => $purpose, 'digest' => hash('sha256', $token), 'expires_at' => now()->addMinutes($minutes), 'created_at' => now(), 'updated_at' => now()], $extra));

        return $token;
    }

    public function consume(string $token, string $purpose, ?int $userId = null): object
    {
        $q = DB::table('cinema_tokens')->where('digest', hash('sha256', $token))->where('purpose', $purpose)->whereNull('consumed_at')->where('expires_at', '>', now());
        if ($userId) {
            $q->where('user_id', $userId);
        }
        $row = $q->lockForUpdate()->first();
        if (! $row) {
            throw ValidationException::withMessages(['token' => 'This code is invalid, expired, or already used.']);
        }
        DB::table('cinema_tokens')->where('id', $row->id)->update(['consumed_at' => now()]);

        return $row;
    }

    public function activate(User $user, string $token): void
    {
        DB::transaction(function () use ($user, $token) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            if ($user->suspended) {
                throw ValidationException::withMessages(['token' => 'Your account is suspended. Contact the administrator.']);
            }
            $row = $this->consume($token, 'subscription', $user->id);
            $start = $user->subscription_ends_at?->isFuture() ? $user->subscription_ends_at->copy() : now();
            $user->forceFill(['plan' => $row->plan, 'subscription_ends_at' => $start->addMonthsNoOverflow($row->months)])->save();
        });
    }

    public function catalog(User $user): array
    {
        $access = $user->access();
        abort_unless($access['active'], 403, 'Choose a plan or contact your administrator.');
        $sites = json_decode(file_get_contents(resource_path('catalog.json')), true)['sites'];
        if ($access['custom_site_limit']) {
            $sites = array_merge($sites, DB::table('custom_sites')->where('user_id', $user->id)->orderByDesc('favorite')->limit($access['custom_site_limit'])->get()->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'url' => $s->url, 'tag' => 'Personal website', 'favorite' => (bool) $s->favorite, 'color' => '#b5e46b'])->all());
        }

        return ['sites' => $sites];
    }

    public function addSite(User $user, array $data): void
    {
        DB::transaction(function () use ($user, $data) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $a = $user->access();
            abort_unless($a['active'] && $a['custom_site_limit'] > 0, 403, 'Personal websites require Plus or Pro.');
            if (DB::table('custom_sites')->where('user_id', $user->id)->count() >= $a['custom_site_limit']) {
                throw ValidationException::withMessages(['url' => 'Your personal website limit has been reached.']);
            }
            $host = parse_url($data['url'], PHP_URL_HOST);
            if (parse_url($data['url'], PHP_URL_SCHEME) !== 'https' || ! $host || ! str_contains($host, '.') || filter_var($host, FILTER_VALIDATE_IP) || preg_match('/(^|\.)(localhost|local|internal|test)$/i', $host) || parse_url($data['url'], PHP_URL_USER) || ! in_array(parse_url($data['url'], PHP_URL_PORT), [null, 443], true)) {
                throw ValidationException::withMessages(['url' => 'Use a public HTTPS website address.']);
            }
            foreach (['netflix.com', 'primevideo.com', 'disneyplus.com', 'hulu.com', 'max.com', 'hbomax.com', 'paramountplus.com', 'tv.apple.com'] as $paidHost) {
                if (strtolower($host) === $paidHost || str_ends_with(strtolower($host), '.'.$paidHost)) {
                    throw ValidationException::withMessages(['url' => 'CineStream is for free movie websites. This paid streaming service is not supported.']);
                }
            }
            if (DB::table('custom_sites')->where('user_id', $user->id)->where('url', $data['url'])->exists()) {
                throw ValidationException::withMessages(['url' => 'This website is already in your directory.']);
            }
            DB::table('custom_sites')->insert(['user_id' => $user->id, 'name' => $data['name'], 'url' => $data['url'], 'created_at' => now(), 'updated_at' => now()]);
        });
    }
}
