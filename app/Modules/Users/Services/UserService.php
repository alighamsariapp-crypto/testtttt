<?php

namespace App\Modules\Users\Services;

use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use App\Modules\Users\Models\User;
use App\Modules\Users\Models\UserAddress;
use Illuminate\Support\Facades\DB;

class UserService implements BaseServiceInterface
{
    public function updateProfile(User $user, array $data): User
    {
        $allowed = array_intersect_key($data, array_flip(['name', 'phone', 'email']));

        $emailChanged = false;
        $phoneChanged = false;

        if (array_key_exists('email', $allowed)) {
            $normalizedEmail = $allowed['email'] ? strtolower(trim($allowed['email'])) : null;
            $emailChanged = $normalizedEmail !== $user->email;
            $allowed['email'] = $normalizedEmail;
        }

        if (array_key_exists('phone', $allowed)) {
            $allowed['phone'] = $this->normalizeIranianPhone($allowed['phone']);
            $phoneChanged = $allowed['phone'] !== $user->phone;
        }

        $user->fill($allowed);

        if ($emailChanged) {
            $user->forceFill(['email_verified_at' => null]);
        }

        if ($phoneChanged) {
            $user->forceFill(['phone_verified_at' => null]);
        }

        $user->save();

        return $user->fresh();
    }

    private function normalizeIranianPhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }

        $phone = strtr(trim($phone), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
        $digits = preg_replace('/[^0-9+]/', '', $phone) ?? '';

        if (str_starts_with($digits, '+98')) {
            $digits = '0'.substr($digits, 3);
        } elseif (str_starts_with($digits, '0098')) {
            $digits = '0'.substr($digits, 4);
        } elseif (str_starts_with($digits, '98')) {
            $digits = '0'.substr($digits, 2);
        } elseif (str_starts_with($digits, '9') && strlen($digits) === 10) {
            $digits = '0'.$digits;
        }

        return $digits === '' ? null : $digits;
    }

    public function addAddress(User $user, array $data): UserAddress
    {
        return DB::transaction(function () use ($user, $data) {
            if (!empty($data['is_default'])) {
                $user->addresses()->where('type', $data['type'] ?? 'shipping')->update(['is_default' => false]);
            }

            return $user->addresses()->create($data);
        });
    }

    public function updateAddress(User $user, int $addressId, array $data): UserAddress
    {
        return DB::transaction(function () use ($user, $addressId, $data) {
            $address = $user->addresses()->find($addressId);
            if (!$address) {
                throw new EntityNotFoundException('Address not found or does not belong to this user.');
            }

            if (!empty($data['is_default'])) {
                $user->addresses()->where('type', $address->type)->update(['is_default' => false]);
            }

            $address->update($data);
            return $address->fresh();
        });
    }

    public function deleteAddress(User $user, int $addressId): void
    {
        $address = $user->addresses()->find($addressId);
        if (!$address) {
            throw new EntityNotFoundException('Address not found or does not belong to this user.');
        }

        $address->delete();
    }
}
