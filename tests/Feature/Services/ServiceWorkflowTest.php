<?php

namespace Tests\Feature\Services;

use Tests\TestCase;

class ServiceWorkflowTest extends TestCase
{
    public function test_public_can_view_active_service_catalog(): void
    {
        $response = $this->getJson('/api/v1/services');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data',
            ])
            ->assertJson(['success' => true]);
    }
}
