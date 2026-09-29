<?php

namespace App\Modules\Auth\Services;

use App\Modules\Auth\Security\TokenAbilities;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\UnauthorizedActionException;
use App\Modules\Shared\Exceptions\ValidationException;
use App\Modules\Users\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Registered;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService implements BaseServiceInterface
{
    public function register(array $data): array
    {
        return DB::transaction(function () use ($data) {
            // Strictly assign customer role upon self-registration to prevent privilege escalation
            $user = User::create([
                'name' => $data['name'],
                'email' => strtolower(trim($data['email'])),
                'phone' => $data['phone'] ?? null,
                'password' => Hash::make($data['password']),
            ]);

            $user->role = User::ROLE_CUSTOMER;
            $user->status = User::STATUS_ACTIVE;
            $user->save();

            event(new Registered($user));

            $token = $user->createToken(
                'auth-token',
                TokenAbilities::forUser($user),
                TokenAbilities::defaultExpiration()
            )->plainTextToken;

            return [
                'user' => $user,
                'token' => $token,
            ];
        });
    }

    public function login(string $email, string $password, ?string $deviceName = null): array
    {
        $user = User::where('email', strtolower(trim($email)))->first();

        if (!$user || !$user->hasPassword() || !Hash::check($password, $user->password)) {
            throw new ValidationException('Invalid email or password provided.', 'INVALID_CREDENTIALS');
        }

        if (!$user->isActive()) {
            throw new UnauthorizedActionException('Account is inactive, suspended, or pending verification.', 'ACCOUNT_DISABLED');
        }

        // Generate Sanctum Personal Access Token with explicit expiry and least-privilege abilities
        $tokenName = $deviceName ? substr(trim($deviceName), 0, 50) : 'api-client';
        $token = $user->createToken(
            $tokenName,
            TokenAbilities::forUser($user),
            TokenAbilities::defaultExpiration()
        )->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    public function logout(User $user, ?string $plainToken = null): void
    {
        // Revoke the exact bearer token used by this request. Depending on the
        // guard/test driver, currentAccessToken() may be a transient token that
        // is not the persisted PersonalAccessToken record.
        $token = $plainToken ? PersonalAccessToken::findToken($plainToken) : $user->currentAccessToken();
        if ($token && (int) $token->tokenable_id === (int) $user->getKey()) {
            $token->delete();
        }
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword, ?string $plainToken = null): void
    {
        if ($user->hasPassword() && !Hash::check($currentPassword, $user->password)) {
            throw new ValidationException('Current password does not match our records.', 'INCORRECT_CURRENT_PASSWORD');
        }

        $user->password = Hash::make($newPassword);
        $user->setRememberToken(Str::random(60));
        $user->save();

        // Invalidate other active API tokens while preserving the exact session
        // that submitted the password change.
        $currentTokenId = $plainToken
            ? PersonalAccessToken::findToken($plainToken)?->id
            : $user->currentAccessToken()?->id;
        $user->tokens()->when($currentTokenId, fn ($query) => $query->where('id', '!=', $currentTokenId))->delete();
    }

    public function sendPasswordResetLink(string $email): string
    {
        $status = Password::broker()->sendResetLink(['email' => strtolower(trim($email))]);
        return $status;
    }

    public function resetPassword(array $credentials): string
    {
        $status = Password::broker()->reset(
            $credentials,
            function (User $user, string $password) {
                $user->password = Hash::make($password);
                $user->setRememberToken(Str::random(60));
                $user->save();

                // A reset can indicate account recovery after compromise; revoke every existing API token.
                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        return $status;
    }
}
