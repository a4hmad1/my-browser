<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivationCodeController extends Controller
{
    public function activate(Request $r)
    {
        $d = $r->validate([
            'code' => 'required|string|size:6|regex:/^\d{6}$/',
            'device_id' => 'required|string|max:128',
        ]);

        $code = DB::table('activation_codes')->where('code', $d['code'])->first();
        if (! $code) {
            return response()->json([
                'ok' => false,
                'error' => 'Invalid activation code.',
            ], 404);
        }

        if ($code->status === 'available') {
            DB::table('activation_codes')->where('id', $code->id)->update([
                'status' => 'used',
                'device_id' => $d['device_id'],
                'activated_at' => now(),
                'ip_address' => $r->ip(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'ok' => true,
                'valid' => true,
                'code' => $code->code,
                'message' => 'Lifetime access activated successfully!',
            ]);
        }

        // Code is already used
        if ($code->device_id && $code->device_id === $d['device_id']) {
            return response()->json([
                'ok' => true,
                'valid' => true,
                'code' => $code->code,
                'message' => 'Lifetime access restored on this device.',
            ]);
        }

        return response()->json([
            'ok' => false,
            'error' => 'This code has already been used on another device. Each code works for 1 installation only. If you reinstalled your browser, please ask the admin to re-activate your code.',
        ], 409);
    }

    public function check(Request $r, string $code)
    {
        if (! preg_match('/^\d{6}$/', $code)) {
            return response()->json(['valid' => false, 'error' => 'Code must be 6 digits.'], 422);
        }

        $row = DB::table('activation_codes')->where('code', $code)->first();
        if (! $row) {
            return response()->json(['valid' => false, 'error' => 'Invalid activation code.'], 404);
        }

        return response()->json([
            'valid' => true,
            'code' => $row->code,
            'status' => $row->status,
            'available' => $row->status === 'available',
        ]);
    }
}
