<?php

namespace App\Modules\Auth\Security;

use App\Modules\Users\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

class TokenAbilities
{
    public const ABILITY_CUSTOMER_ACCESS = 'customer:access';
    public const ABILITY_ORDERS_CREATE = 'orders:create';
    public const ABILITY_ORDERS_VIEW = 'orders:view';
    public const ABILITY_PROFILE_MANAGE = 'profile:manage';
    public const ABILITY_CART_MANAGE = 'cart:manage';

    public const ABILITY_ADMIN_ACCESS = 'admin:access';
    public const ABILITY_PRODUCTS_MANAGE = 'products:manage';
    public const ABILITY_ORDERS_MANAGE = 'orders:manage';
    public const ABILITY_USERS_MANAGE = 'users:manage';
    public const ABILITY_SETTINGS_MANAGE = 'settings:manage';
    public const ABILITY_REPORTS_VIEW = 'reports:view';

    public const ABILITY_STAFF_ACCESS = 'staff:access';
    public const ABILITY_SUPPORT_MANAGE = 'support:manage';

    public const ABILITY_PAYMENTS_SIMULATE = 'payments:simulate';

    /**
     * Least-privilege abilities mapping per user role.
     * Universal wildcard ['*'] is strictly avoided; tokens are explicitly scoped.
     *
     * @return string[]
     */
    public static function forUser(User $user): array
    {
        return match ($user->role) {
            User::ROLE_ADMIN => [
                self::ABILITY_ADMIN_ACCESS,
                self::ABILITY_PRODUCTS_MANAGE,
                self::ABILITY_ORDERS_MANAGE,
                self::ABILITY_USERS_MANAGE,
                self::ABILITY_SETTINGS_MANAGE,
                self::ABILITY_REPORTS_VIEW,
                self::ABILITY_CUSTOMER_ACCESS,
                self::ABILITY_ORDERS_VIEW,
                self::ABILITY_PROFILE_MANAGE,
            ],
            User::ROLE_STAFF => [
                self::ABILITY_STAFF_ACCESS,
                self::ABILITY_ORDERS_VIEW,
                self::ABILITY_SUPPORT_MANAGE,
                self::ABILITY_CUSTOMER_ACCESS,
            ],
            default => [
                self::ABILITY_CUSTOMER_ACCESS,
                self::ABILITY_ORDERS_CREATE,
                self::ABILITY_ORDERS_VIEW,
                self::ABILITY_PROFILE_MANAGE,
                self::ABILITY_CART_MANAGE,
            ],
        };
    }

    /**
     * Staging/test operator abilities with explicit payments:simulate privilege.
     * Production admin tokens via forUser() MUST NOT automatically receive this ability.
     *
     * @return string[]
     */
    public static function forTestOperator(User $user): array
    {
        return array_unique(array_merge(self::forUser($user), [
            self::ABILITY_PAYMENTS_SIMULATE,
        ]));
    }

    /**
     * Compute explicit token expiration datetime from sanctum configuration.
     */
    public static function defaultExpiration(): CarbonInterface
    {
        $minutes = (int) config('sanctum.expiration', 10080);
        return Carbon::now()->addMinutes($minutes > 0 ? $minutes : 10080);
    }
}
