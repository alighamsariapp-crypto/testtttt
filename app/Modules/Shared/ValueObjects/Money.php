<?php

namespace App\Modules\Shared\ValueObjects;

use InvalidArgumentException;
use JsonSerializable;
use Stringable;

/**
 * Immutable Money Value Object
 *
 * Stores currency amounts as exact integers in the smallest currency unit (e.g. Rials / Cents)
 * to completely eliminate IEEE 754 floating-point inaccuracies in financial calculations.
 */
final class Money implements JsonSerializable, Stringable
{
    private int $amount;
    private string $currency;

    public function __construct(int $amount, string $currency = 'IRR')
    {
        $this->amount = $amount;
        $this->currency = strtoupper(trim($currency));
    }

    public static function from(int $amount, string $currency = 'IRR'): self
    {
        return new self($amount, $currency);
    }

    public static function zero(string $currency = 'IRR'): self
    {
        return new self(0, $currency);
    }

    public function getAmount(): int
    {
        return $this->amount;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function add(Money $other): self
    {
        $this->assertSameCurrency($other);
        return new self($this->amount + $other->amount, $this->currency);
    }

    public function subtract(Money $other): self
    {
        $this->assertSameCurrency($other);
        $result = $this->amount - $other->amount;
        if ($result < 0) {
            throw new InvalidArgumentException('Money amount cannot be negative after subtraction.');
        }
        return new self($result, $this->currency);
    }

    public function multiply(int|float $multiplier): self
    {
        if ($multiplier < 0) {
            throw new InvalidArgumentException('Money multiplier cannot be negative.');
        }
        return new self((int) round($this->amount * $multiplier), $this->currency);
    }

    public function isGreaterThan(Money $other): bool
    {
        $this->assertSameCurrency($other);
        return $this->amount > $other->amount;
    }

    public function isLessThan(Money $other): bool
    {
        $this->assertSameCurrency($other);
        return $this->amount < $other->amount;
    }

    public function isEqualTo(Money $other): bool
    {
        return $this->currency === $other->currency && $this->amount === $other->amount;
    }

    public function isZero(): bool
    {
        return $this->amount === 0;
    }

    private function assertSameCurrency(Money $other): void
    {
        if ($this->currency !== $other->currency) {
            throw new InvalidArgumentException(
                sprintf('Currency mismatch: cannot perform operation between %s and %s.', $this->currency, $other->currency)
            );
        }
    }

    public function jsonSerialize(): array
    {
        return [
            'amount' => $this->amount,
            'currency' => $this->currency,
            'formatted' => number_format($this->amount).' '.$this->currency,
        ];
    }

    public function __toString(): string
    {
        return number_format($this->amount).' '.$this->currency;
    }
}
