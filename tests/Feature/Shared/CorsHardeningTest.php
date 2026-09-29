<?php

namespace Tests\Feature\Shared;

use App\Modules\Shared\Security\CorsService;
use Illuminate\Support\Facades\Config;
use LogicException;
use Tests\TestCase;

class CorsHardeningTest extends TestCase
{
    /**
     * Acceptance Test A: Unknown origins receive no permissive CORS headers.
     */
    public function test_a_unknown_origin_receives_no_permissive_cors_headers(): void
    {
        Config::set('cors.allowed_origins', ['https://apexstore.ir']);
        Config::set('cors.supports_credentials', false);

        // Standard GET request from unknown origin
        $response = $this->withHeaders([
            'Origin' => 'https://evil-attacker.com',
        ])->getJson('/api/v1/health');

        $response->assertStatus(200);
        $this->assertNull(
            $response->headers->get('Access-Control-Allow-Origin'),
            'Unknown origin must not receive Access-Control-Allow-Origin header.'
        );

        // Preflight OPTIONS from unknown origin
        $preflight = $this->call('OPTIONS', '/api/v1/health', [], [], [], [
            'HTTP_ORIGIN' => 'https://evil-attacker.com',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
        ]);

        $this->assertNull(
            $preflight->headers->get('Access-Control-Allow-Origin'),
            'Preflight from unknown origin must not receive Access-Control-Allow-Origin header.'
        );
    }

    /**
     * Acceptance Test B: Production with wildcard credentials fails validation.
     */
    public function test_b_production_with_wildcard_credentials_fails_validation(): void
    {
        // 1. Wildcard with supports_credentials = true must fail
        $this->expectException(LogicException::class);
        $this->expectExceptionMessageMatches('/supports_credentials.*wildcard/i');

        CorsService::validateConfiguration('production', ['*'], true);
    }

    public function test_b_production_with_wildcard_origin_fails_validation(): void
    {
        // 2. Wildcard alone in production must fail even without credentials
        $this->expectException(LogicException::class);
        $this->expectExceptionMessageMatches('/Wildcard origin.*prohibited in production/i');

        CorsService::validateConfiguration('production', ['*'], false);
    }

    public function test_b_production_with_empty_origins_fails_validation(): void
    {
        // 3. Empty allowlist in production must fail
        $this->expectException(LogicException::class);
        $this->expectExceptionMessageMatches('/No allowed origins defined for production/i');

        CorsService::validateConfiguration('production', [], false);
    }

    /**
     * Acceptance Test C: Allowed origin preflight returns only approved methods and headers.
     */
    public function test_c_allowed_origin_preflight_returns_only_approved_methods_and_headers(): void
    {
        Config::set('cors.allowed_origins', ['https://apexstore.ir']);
        Config::set('cors.allowed_methods', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
        Config::set('cors.allowed_headers', ['Content-Type', 'Authorization', 'Accept', 'X-Session-ID', 'X-Idempotency-Key', 'X-Requested-With']);
        Config::set('cors.supports_credentials', false);

        $response = $this->call('OPTIONS', '/api/v1/health', [], [], [], [
            'HTTP_ORIGIN' => 'https://apexstore.ir',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'Content-Type, Authorization, X-Session-ID',
        ]);

        $this->assertSame('https://apexstore.ir', $response->headers->get('Access-Control-Allow-Origin'));
        $allowMethods = array_map('trim', explode(',', (string) $response->headers->get('Access-Control-Allow-Methods')));
        $this->assertTrue(in_array('GET', $allowMethods, true));
        $this->assertTrue(in_array('POST', $allowMethods, true));
        $this->assertTrue(in_array('PUT', $allowMethods, true));
        $this->assertTrue(in_array('DELETE', $allowMethods, true));
        $this->assertTrue(in_array('OPTIONS', $allowMethods, true));
        $this->assertFalse(in_array('PATCH', $allowMethods, true), 'Unused method PATCH should not be returned');

        $allowHeaders = array_map('trim', explode(',', (string) $response->headers->get('Access-Control-Allow-Headers')));
        $this->assertTrue(in_array('Authorization', $allowHeaders, true));
        $this->assertTrue(in_array('X-Session-ID', $allowHeaders, true));
        $this->assertFalse(in_array('X-Secret-Internal', $allowHeaders, true));
    }

    /**
     * Acceptance Test D: Staging and production allowlists are independent.
     */
    public function test_d_staging_and_production_allowlists_are_independent(): void
    {
        putenv('CORS_ALLOWED_ORIGINS_PRODUCTION=https://apexstore.ir,https://admin.apexstore.ir');
        putenv('CORS_ALLOWED_ORIGINS_STAGING=https://staging.apexstore.ir');

        $prodOrigins = CorsService::resolveOrigins('production');
        $stagingOrigins = CorsService::resolveOrigins('staging');

        $this->assertSame(['https://apexstore.ir', 'https://admin.apexstore.ir'], $prodOrigins);
        $this->assertSame(['https://staging.apexstore.ir'], $stagingOrigins);

        // Verify isolation
        $this->assertFalse(in_array('https://staging.apexstore.ir', $prodOrigins, true));
        $this->assertFalse(in_array('https://apexstore.ir', $stagingOrigins, true));

        // Cleanup
        putenv('CORS_ALLOWED_ORIGINS_PRODUCTION');
        putenv('CORS_ALLOWED_ORIGINS_STAGING');
    }

    /**
     * Acceptance Test E: Browser login/API requests work from the approved origin.
     */
    public function test_e_browser_api_requests_work_from_approved_origin(): void
    {
        Config::set('cors.allowed_origins', ['https://apexstore.ir']);
        Config::set('cors.supports_credentials', false);

        $response = $this->withHeaders([
            'Origin' => 'https://apexstore.ir',
            'Accept' => 'application/json',
        ])->getJson('/api/v1/health');

        $response->assertStatus(200);
        $this->assertSame('https://apexstore.ir', $response->headers->get('Access-Control-Allow-Origin'));
        $this->assertSame('Origin', $response->headers->get('Vary'));
    }

    /**
     * Missing Origin header test: treated as direct/same-origin server request.
     */
    public function test_missing_origin_header_is_processed_without_cors_headers(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200);
        $this->assertNull($response->headers->get('Access-Control-Allow-Origin'));
    }

    /**
     * Origin normalization test: exact scheme, host, and port matching.
     */
    public function test_origin_normalization_cleans_trailing_slashes_and_default_ports(): void
    {
        $this->assertSame('https://apexstore.ir', CorsService::normalizeOrigin('https://ApexStore.ir/'));
        $this->assertSame('https://apexstore.ir', CorsService::normalizeOrigin('https://apexstore.ir:443/'));
        $this->assertSame('http://localhost:3000', CorsService::normalizeOrigin('http://localhost:3000/'));
        $this->assertSame('http://example.com', CorsService::normalizeOrigin('http://example.com:80'));
        $this->assertNull(CorsService::normalizeOrigin('javascript:alert(1)'));
        $this->assertNull(CorsService::normalizeOrigin('not-a-valid-url'));
    }
}
