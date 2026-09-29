<?php

namespace Tests\Feature\Shared;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_api_response_contains_safe_configured_security_headers(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-XSS-Protection', '1; mode=block');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
}
