<?php

namespace Tests\Feature\Shared;

use Tests\TestCase;

class ApiResponseStructureTest extends TestCase
{
    public function test_api_404_returns_standard_json_envelope(): void
    {
        $response = $this->getJson('/api/v1/non-existent-route-999');

        $response->assertStatus(404)
            ->assertJson([
                'success' => false,
                'error_code' => 'NOT_FOUND',
            ]);
    }
}
