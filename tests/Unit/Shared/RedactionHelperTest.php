<?php

namespace Tests\Unit\Shared;

use App\Modules\Shared\Helpers\RedactionHelper;
use PHPUnit\Framework\TestCase;

class RedactionHelperTest extends TestCase
{
    public function test_it_redacts_sensitive_keys_in_flat_array(): void
    {
        $helper = new RedactionHelper();

        $input = [
            'username' => 'alex_dev',
            'password' => 'secret_1234',
            'api_token' => 'Bearer abcxyz',
            'email' => 'alex@example.com',
        ];

        $output = $helper->redact($input);

        $this->assertSame('alex_dev', $output['username']);
        $this->assertSame('[REDACTED]', $output['password']);
        $this->assertSame('[REDACTED]', $output['api_token']);
        $this->assertSame('alex@example.com', $output['email']);
    }

    public function test_it_recursively_redacts_nested_arrays(): void
    {
        $helper = new RedactionHelper();

        $input = [
            'order' => [
                'id' => 101,
                'customer' => [
                    'name' => 'John',
                    'card_number' => '4111222233334444',
                    'cvv' => '123',
                ],
            ],
        ];

        $output = $helper->redact($input);

        $this->assertSame(101, $output['order']['id']);
        $this->assertSame('John', $output['order']['customer']['name']);
        $this->assertSame('[REDACTED]', $output['order']['customer']['card_number']);
        $this->assertSame('[REDACTED]', $output['order']['customer']['cvv']);
    }
}
