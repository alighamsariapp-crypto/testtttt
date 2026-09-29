<?php

namespace Tests\Feature\Admin;

use Tests\TestCase;

class AdminAccessAndAuditTest extends TestCase
{
    public function test_unauthenticated_request_to_admin_dashboard_is_rejected(): void
    {
        $response = $this->getJson('/api/v1/admin/dashboard');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'UNAUTHENTICATED',
            ]);
    }
}
