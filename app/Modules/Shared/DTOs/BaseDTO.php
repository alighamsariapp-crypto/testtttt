<?php

namespace App\Modules\Shared\DTOs;

use Illuminate\Contracts\Support\Arrayable;
use JsonSerializable;
use ReflectionClass;
use ReflectionProperty;

/**
 * Immutable Base Data Transfer Object
 *
 * Provides typed, immutable serialization across module boundaries.
 */
abstract class BaseDTO implements Arrayable, JsonSerializable
{
    /**
     * Instantiate DTO from an associative array.
     */
    public static function fromArray(array $data): static
    {
        $reflection = new ReflectionClass(static::class);
        $constructor = $reflection->getConstructor();

        if (!$constructor) {
            return new static();
        }

        $args = [];
        foreach ($constructor->getParameters() as $param) {
            $name = $param->getName();
            if (array_key_exists($name, $data)) {
                $args[] = $data[$name];
            } elseif ($param->isDefaultValueAvailable()) {
                $args[] = $param->getDefaultValue();
            } else {
                $args[] = null;
            }
        }

        return $reflection->newInstanceArgs($args);
    }

    /**
     * Convert DTO properties to an associative array.
     */
    public function toArray(): array
    {
        $reflection = new ReflectionClass($this);
        $properties = $reflection->getProperties(ReflectionProperty::IS_PUBLIC | ReflectionProperty::IS_PROTECTED | ReflectionProperty::IS_PRIVATE);

        $result = [];
        foreach ($properties as $property) {
            $property->setAccessible(true);
            $value = $property->getValue($this);

            if ($value instanceof Arrayable) {
                $result[$property->getName()] = $value->toArray();
            } elseif ($value instanceof JsonSerializable) {
                $result[$property->getName()] = $value->jsonSerialize();
            } else {
                $result[$property->getName()] = $value;
            }
        }

        return $result;
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
