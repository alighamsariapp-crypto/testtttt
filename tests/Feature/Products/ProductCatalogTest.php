<?php

namespace Tests\Feature\Products;

use Tests\TestCase;

class ProductCatalogTest extends TestCase
{
    public function test_public_catalog_endpoint_returns_paginated_products(): void
    {
        $response = $this->getJson('/api/v1/products');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'data',
                    'current_page',
                    'per_page',
                    'total',
                ],
            ])
            ->assertJson(['success' => true]);
    }
}
