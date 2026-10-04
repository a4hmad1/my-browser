<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activation_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 6)->unique();
            $table->string('status', 20)->default('available'); // available, used
            $table->string('device_id', 128)->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // Seed the 100 codes from json or list
        $codesPath = dirname(__DIR__, 3) . '/src/activation-codes.json';
        if (!file_exists($codesPath)) {
            $codesPath = base_path('../src/activation-codes.json');
        }
        if (file_exists($codesPath)) {
            $codes = json_decode(file_get_contents($codesPath), true);
            if (is_array($codes)) {
                $now = now();
                $rows = array_map(fn ($code) => [
                    'code' => (string) $code,
                    'status' => 'available',
                    'device_id' => null,
                    'activated_at' => null,
                    'ip_address' => null,
                    'notes' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $codes);
                DB::table('activation_codes')->insert($rows);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('activation_codes');
    }
};
