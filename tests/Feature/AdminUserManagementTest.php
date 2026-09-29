<?php

namespace Tests\Feature;

use App\Modules\Orders\Models\Order;
use App\Modules\Support\Models\SupportTicket;
use App\Modules\Users\Models\User;
use App\Modules\Users\Models\UserAddress;
use App\Modules\Wallet\Models\WalletTransaction;
use Tests\TestCase;

class AdminUserManagementTest extends TestCase
{
    public function test_admin_users_endpoint_returns_real_wallet_balance_for_each_customer(): void
    {
        $this->actingAsAdmin();
        $customer = $this->createCustomer([
            'name' => 'مشتری آزمون API',
            'email' => 'customer-api@example.test',
            'phone' => '09121234567',
        ]);
        $customer->forceFill([
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ])->save();
        UserAddress::create([
            'user_id' => $customer->id,
            'type' => 'shipping',
            'title' => 'خانه',
            'recipient_name' => 'مشتری آزمون API',
            'phone' => '09121234567',
            'province' => 'تهران',
            'city' => 'تهران',
            'postal_code' => '1234567890',
            'address_line' => 'تهران، خیابان آزمون، پلاک ۱',
            'is_default' => true,
        ]);
        $this->recordOrder($customer);
        SupportTicket::create([
            'ticket_number' => 'TKT-API-1',
            'user_id' => $customer->id,
            'title' => 'پیگیری آزمون',
            'department' => 'پشتیبانی',
            'status' => SupportTicket::STATUS_OPEN,
            'priority' => 'medium',
        ]);

        $this->recordWalletTransaction($customer, 'deposit', 250000);
        $this->recordWalletTransaction($customer, 'purchase', 50000);
        $this->recordWalletTransaction($customer, 'deposit', 999999, WalletTransaction::STATUS_PENDING);

        $this->getJson('/api/v1/admin/users?search=customer-api@example.test')
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.id', $customer->id)
            ->assertJsonPath('data.data.0.email', 'customer-api@example.test')
            ->assertJsonPath('data.data.0.phone', '09121234567')
            ->assertJsonPath('data.data.0.wallet_balance', 200000)
            ->assertJsonPath('data.data.0.orders_count', 1)
            ->assertJsonPath('data.data.0.open_tickets_count', 1)
            ->assertJsonPath('data.data.0.has_password', true)
            ->assertJsonPath('data.data.0.addresses.0.title', 'خانه')
            ->assertJsonPath('data.data.0.addresses.0.is_default', true)
            ->assertJsonPath('data.data.0.addresses.0.city', 'تهران');
    }

    public function test_admin_can_update_customer_role_and_status_without_losing_wallet_balance(): void
    {
        $this->actingAsAdmin();
        $customer = $this->createCustomer();
        $this->recordWalletTransaction($customer, 'deposit', 350000);

        $this->patchJson('/api/v1/admin/users/'.$customer->id.'/status', [
            'role' => User::ROLE_STAFF,
            'status' => User::STATUS_SUSPENDED,
        ])
            ->assertOk()
            ->assertJsonPath('data.id', $customer->id)
            ->assertJsonPath('data.role', User::ROLE_STAFF)
            ->assertJsonPath('data.status', User::STATUS_SUSPENDED)
            ->assertJsonPath('data.wallet_balance', 350000);

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'role' => User::ROLE_STAFF,
            'status' => User::STATUS_SUSPENDED,
        ]);
    }

    private function recordOrder(User $user): void
    {
        Order::create([
            'order_number' => 'ORD-API-'.str()->upper(str()->random(8)),
            'user_id' => $user->id,
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => 'paid',
            'subtotal' => 300000,
            'grand_total' => 300000,
            'currency' => 'IRR',
            'shipping_address_snapshot' => [
                'recipient_name' => $user->name,
                'phone' => $user->phone,
                'address_line' => 'تهران، خیابان آزمون، پلاک ۱',
            ],
        ]);
    }

    private function recordWalletTransaction(User $user, string $type, int $amount, string $status = WalletTransaction::STATUS_SUCCESSFUL): void
    {
        WalletTransaction::create([
            'user_id' => $user->id,
            'type' => $type,
            'amount' => $amount,
            'currency' => 'IRR',
            'status' => $status,
            'reference' => 'TEST-'.str()->upper(str()->random(12)),
            'description' => 'Test wallet transaction',
        ]);
    }
}
