<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->boolean('is_admin')->default(false);
            $t->boolean('suspended')->default(false);
            $t->timestamp('trial_ends_at')->nullable();
            $t->string('plan')->nullable();
            $t->timestamp('subscription_ends_at')->nullable();
            $t->string('telegram_id')->nullable()->unique();
        });
        Schema::create('cinema_tokens', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('purpose');
            $t->string('digest', 64)->unique();
            $t->string('plan')->nullable();
            $t->unsignedInteger('months')->nullable();
            $t->timestamp('expires_at');
            $t->timestamp('consumed_at')->nullable();
            $t->timestamps();
        });
        Schema::create('custom_sites', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('name', 80);
            $t->string('url', 500);
            $t->boolean('favorite')->default(false);
            $t->timestamps();
        });
        Schema::create('admin_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('admin_id')->constrained('users');
            $t->foreignId('user_id')->constrained('users');
            $t->string('action');
            $t->json('details')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_events');
        Schema::dropIfExists('custom_sites');
        Schema::dropIfExists('cinema_tokens');
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['is_admin', 'suspended', 'trial_ends_at', 'plan', 'subscription_ends_at', 'telegram_id']));
    }
};
