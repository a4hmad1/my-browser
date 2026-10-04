<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('telegram_username', 32)->nullable()->unique();
            $t->timestamp('telegram_verified_at')->nullable();
        });
        Schema::create('subscription_requests', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('plan');
            $t->unsignedInteger('months');
            $t->unsignedInteger('amount');
            $t->string('status')->default('pending');
            $t->timestamps();
        });
        Schema::create('telegram_deliveries', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('admin_id')->constrained('users');
            $t->foreignId('request_id')->nullable()->unique()->constrained('subscription_requests');
            $t->string('token_digest', 64);
            $t->text('encrypted_code')->nullable();
            $t->string('plan');
            $t->unsignedInteger('months');
            $t->string('status')->default('pending');
            $t->unsignedInteger('attempts')->default(0);
            $t->string('error')->nullable();
            $t->timestamp('sent_at')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telegram_deliveries');
        Schema::dropIfExists('subscription_requests');
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['telegram_username', 'telegram_verified_at']));
    }
};
