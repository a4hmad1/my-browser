<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ActivationCodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_code_can_be_activated_once_and_bound_to_device(): void
    {
        $code = '100911';

        // 1. Initial status is available
        $res = $this->getJson("/api/activation-codes/check/{$code}");
        $res->assertOk();
        $res->assertJson(['valid' => true, 'available' => true]);

        // 2. First activation succeeds and binds to device-A
        $res1 = $this->postJson('/api/activation-codes/activate', [
            'code' => $code,
            'device_id' => 'device-A',
        ]);
        $res1->assertOk();
        $res1->assertJson(['ok' => true, 'valid' => true]);

        // 3. Same device can restore access
        $resRestore = $this->postJson('/api/activation-codes/activate', [
            'code' => $code,
            'device_id' => 'device-A',
        ]);
        $resRestore->assertOk();

        // 4. Second device is rejected (single-use enforcement)
        $res2 = $this->postJson('/api/activation-codes/activate', [
            'code' => $code,
            'device_id' => 'device-B',
        ]);
        $res2->assertStatus(409);
        $res2->assertJson(['ok' => false]);

        // 5. Admin reactivates code
        $admin = User::factory()->create(['is_admin' => true]);
        $row = DB::table('activation_codes')->where('code', $code)->first();
        $resAdmin = $this->actingAs($admin)->post("/admin/activation-codes/{$row->id}/reactivate");
        $resAdmin->assertRedirect();

        // 6. Now device-B can activate the code!
        $res3 = $this->postJson('/api/activation-codes/activate', [
            'code' => $code,
            'device_id' => 'device-B',
        ]);
        $res3->assertOk();
        $res3->assertJson(['ok' => true, 'valid' => true]);
    }
}
