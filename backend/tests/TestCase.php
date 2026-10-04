<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['cinema.telegram_token' => null, 'cinema.telegram_username' => null, 'cinema.telegram_secret' => null]);
        Http::preventStrayRequests();
    }
}
