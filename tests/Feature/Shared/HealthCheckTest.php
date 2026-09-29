<?php

namespace Tests\Feature\Shared;

use App\Modules\Users\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    /**
     * Acceptance Test A: Public /api/v1/health contains only minimal stable schema
     * and NO environment/cache/queue/session driver fields.
     */
    public function test_public_health_endpoint_contains_no_driver_or_environment_fields(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'status',
                    'version',
                    'timestamp',
                ],
            ])
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'healthy',
                ],
            ]);

        $data = $response->json('data');

        // Strictly verify that NO sensitive infrastructure or driver fields are disclosed
        $this->assertArrayNotHasKey('environment', $data, 'Health check must not expose environment');
        $this->assertArrayNotHasKey('framework', $data, 'Health check must not expose framework');
        $this->assertArrayNotHasKey('cache_driver', $data, 'Health check must not expose cache_driver');
        $this->assertArrayNotHasKey('queue_driver', $data, 'Health check must not expose queue_driver');
        $this->assertArrayNotHasKey('session_driver', $data, 'Health check must not expose session_driver');
        $this->assertArrayNotHasKey('database', $data, 'Health check must not expose database name');
        $this->assertArrayNotHasKey('debug', $response->json(), 'Health check must not expose debug fields');

        // Verify security headers are present
        $this->assertNotEmpty($response->headers->get('X-Content-Type-Options'));
        $this->assertNotEmpty($response->headers->get('X-Frame-Options'));
    }

    /**
     * Acceptance Test B: Public health response is valid JSON in success and failure cases.
     */
    public function test_backward_compatible_health_endpoint_is_valid_json(): void
    {
        $response = $this->getJson('/health');

        $response->assertStatus(200)
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'healthy');

        $this->assertArrayNotHasKey('environment', $response->json('data'));
        $this->assertArrayNotHasKey('cache_driver', $response->json('data'));
    }

    /**
     * Acceptance Test C: Protected diagnostics returns 401/403 without authorization.
     */
    public function test_protected_diagnostics_requires_admin_authorization(): void
    {
        // 1. Unauthenticated request must return 401
        $unauthenticatedResponse = $this->getJson('/api/v1/diagnostics');
        $this->assertTrue(
            in_array($unauthenticatedResponse->getStatusCode(), [401, 403]),
            'Unauthenticated request to diagnostics must receive 401 or 403'
        );

        // 2. Regular customer user must return 403 Forbidden
        $customer = User::factory()->create([
            'role' => 'customer',
            'status' => 'active',
        ]);
        Sanctum::actingAs($customer, ['customer:read']);

        $forbiddenResponse = $this->getJson('/api/v1/diagnostics');
        $forbiddenResponse->assertStatus(403);

        // 3. Admin user must succeed with 200 and sanitized dependency status
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);
        Sanctum::actingAs($admin, ['*']);

        $adminResponse = $this->getJson('/api/v1/diagnostics');
        $adminResponse->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'status',
                    'version',
                    'timestamp',
                    'dependencies' => [
                        'database',
                        'cache',
                        'storage',
                    ],
                ],
            ]);

        // Verify dependencies do not disclose implementation details (e.g. driver names, paths, hosts)
        $dependencies = $adminResponse->json('data.dependencies');
        $this->assertContains($dependencies['database'], ['connected', 'disconnected']);
        $this->assertContains($dependencies['cache'], ['operational', 'degraded']);
        $this->assertContains($dependencies['storage'], ['writable', 'readonly']);
    }

    /**
     * Acceptance Test D: Production exception responses contain no file path or stack trace.
     */
    public function test_production_exception_response_contains_no_file_path_or_stack_trace(): void
    {
        config(['app.env' => 'production']);
        config(['app.debug' => false]);

        // Query non-existent route or trigger 404/500
        $response = $this->getJson('/api/v1/non-existent-endpoint-test-route');
        $response->assertStatus(404);

        $body = $response->json();
        $this->assertArrayNotHasKey('debug', $body, 'Production error response must never contain debug field');
        $this->assertArrayNotHasKey('trace', $body, 'Production error response must never contain trace');
        $this->assertArrayNotHasKey('file', $body, 'Production error response must never contain file path');

        // Security headers must be present on error responses
        $this->assertNotEmpty($response->headers->get('X-Content-Type-Options'));
        $this->assertNotEmpty($response->headers->get('X-Frame-Options'));
    }
}
