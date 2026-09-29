<?php

namespace Tests\Unit\Shared;

use App\Modules\Shared\ValueObjects\Money;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_can_instantiate_money_with_integer_amount(): void
    {
        $money = Money::from(500000, 'IRR');

        $this->assertSame(500000, $money->getAmount());
        $this->assertSame('IRR', $money->getCurrency());
        $this->assertSame('500,000 IRR', (string) $money);
    }

    public function test_money_addition_preserves_exact_integers(): void
    {
        $m1 = Money::from(150000, 'IRR');
        $m2 = Money::from(350000, 'IRR');

        $result = $m1->add($m2);

        $this->assertSame(500000, $result->getAmount());
        $this->assertSame('IRR', $result->getCurrency());
    }

    public function test_money_subtraction_works_correctly(): void
    {
        $m1 = Money::from(500000, 'IRR');
        $m2 = Money::from(200000, 'IRR');

        $result = $m1->subtract($m2);

        $this->assertSame(300000, $result->getAmount());
    }

    public function test_money_subtraction_throws_on_negative_result(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $m1 = Money::from(100000, 'IRR');
        $m2 = Money::from(200000, 'IRR');

        $m1->subtract($m2);
    }

    public function test_money_multiplication_rounds_safely(): void
    {
        $money = Money::from(100000, 'IRR');
        $result = $money->multiply(1.09); // 9% tax

        $this->assertSame(109000, $result->getAmount());
    }

    public function test_money_mismatched_currencies_throw_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $m1 = Money::from(100000, 'IRR');
        $m2 = Money::from(10, 'USD');

        $m1->add($m2);
    }
}
