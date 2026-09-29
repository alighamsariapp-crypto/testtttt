<?php

namespace Tests\Unit\Shared;

use App\Modules\Shared\DTOs\BaseDTO;
use PHPUnit\Framework\TestCase;

class SampleUserDTO extends BaseDTO
{
    public function __construct(
        public readonly string $name,
        public readonly string $email,
        public readonly ?string $role = 'customer'
    ) {}
}

class BaseDTOTest extends TestCase
{
    public function test_can_hydrate_and_serialize_dto(): void
    {
        $data = [
            'name' => 'Sara Ahmadi',
            'email' => 'sara@example.com',
            'role' => 'staff',
        ];

        $dto = SampleUserDTO::fromArray($data);

        $this->assertSame('Sara Ahmadi', $dto->name);
        $this->assertSame('sara@example.com', $dto->email);
        $this->assertSame('staff', $dto->role);

        $serialized = $dto->toArray();
        $this->assertSame($data, $serialized);
    }
}
