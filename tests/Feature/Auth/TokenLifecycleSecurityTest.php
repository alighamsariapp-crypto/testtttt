<?php

namespace Tests\Feature\Auth;

use App\Modules\Auth\Security\TokenAbilities;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class TokenLifecycleSecurityTest extends TestCase
{
    /**
     * Acceptance Test A: A token past expiry receives 401.
     */
    public function test_token_past_expiry_receives_401(): void
    {
        $user = $this->createCustomer([
            'email' => 'expired_user@example.com',
            'password' => Hash::make('SecretPass123!'),
        ]);

        // Create an expired token (expires_at in the past)
        $newAccessToken = $user->createToken('expired-device', TokenAbilities::forUser($user), now()->subMinutes(10));
        $plainToken = $newAccessToken->plainTextToken;

        // Verify request with expired token fails with 401
        $response = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/v1/auth/me');

        $response->assertUnauthorized();
    }

    /**
     * Acceptance Test B: Logout makes the same token unusable.
     */
    public function test_logout_makes_the_same_token_unusable(): void
    {
        $user = $this->createCustomer([
            'email' => 'logout_user@example.com',
            'password' => Hash::make('SecretPass123!'),
        ]);

        $loginResponse = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'SecretPass123!',
        ])->assertOk();

        $plainToken = $loginResponse->json('data.token');
        $this->assertNotEmpty($plainToken);

        // Authenticated request works initially
        $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk();

        // Perform logout
        $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->postJson('/api/v1/auth/logout')
            ->assertOk();

        $this->app['auth']->forgetGuards();

        // The exact same token is now revoked and rejected
        $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();
    }

    /**
     * Acceptance Test C: Password reset invalidates old sessions according to policy.
     */
    public function test_password_change_invalidates_other_sessions(): void
    {
        $user = $this->createCustomer([
            'email' => 'pwd_change@example.com',
            'password' => Hash::make('OldSecretPass123!'),
        ]);

        // Issue two sessions
        $token1 = $user->createToken('session-1', TokenAbilities::forUser($user), now()->addDays(7))->plainTextToken;
        $token2 = $user->createToken('session-2', TokenAbilities::forUser($user), now()->addDays(7))->plainTextToken;

        // Both sessions work initially
        $this->withHeader('Authorization', 'Bearer ' . $token1)->getJson('/api/v1/auth/me')->assertOk();
        $this->withHeader('Authorization', 'Bearer ' . $token2)->getJson('/api/v1/auth/me')->assertOk();

        // Session 1 changes password
        $this->withHeader('Authorization', 'Bearer ' . $token1)->postJson('/api/v1/auth/change-password', [
            'current_password' => 'OldSecretPass123!',
            'password' => 'NewSecretPass123!',
            'password_confirmation' => 'NewSecretPass123!',
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        // Current session (token1) remains active
        $this->withHeader('Authorization', 'Bearer ' . $token1)->getJson('/api/v1/auth/me')->assertOk();

        // Other session (token2) is now revoked
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer ' . $token2)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    /**
     * Acceptance Test D: A user cannot delete another user's session ID.
     */
    public function test_user_cannot_delete_another_users_session(): void
    {
        $victim = $this->createCustomer(['email' => 'victim@example.com']);
        $attacker = $this->createCustomer(['email' => 'attacker@example.com']);

        $victimToken = $victim->createToken('victim-device', TokenAbilities::forUser($victim), now()->addDays(7));
        $attackerToken = $attacker->createToken('attacker-device', TokenAbilities::forUser($attacker), now()->addDays(7))->plainTextToken;

        // Attacker attempts to delete victim's session ID
        $response = $this->withHeader('Authorization', 'Bearer ' . $attackerToken)
            ->deleteJson('/api/v1/users/sessions/' . $victimToken->accessToken->id);

        $response->assertStatus(404)
            ->assertJsonPath('error_code', 'SESSION_NOT_FOUND');

        // Victim's session remains intact
        $this->assertDatabaseHas('personal_access_tokens', [
            'id' => $victimToken->accessToken->id,
            'tokenable_id' => $victim->id,
        ]);
    }

    /**
     * Acceptance Test E: New database records do not contain plaintext bearer tokens.
     */
    public function test_new_database_records_do_not_contain_plaintext_tokens(): void
    {
        $user = $this->createCustomer([
            'email' => 'hash_check@example.com',
            'password' => Hash::make('SecurePass123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'SecurePass123!',
        ])->assertOk();

        $plainToken = $response->json('data.token');
        $this->assertNotEmpty($plainToken);

        // The raw bearer token must NOT exist in plaintext anywhere in the personal_access_tokens table
        $matches = DB::table('personal_access_tokens')
            ->where('token', $plainToken)
            ->count();

        $this->assertEquals(0, $matches, 'Plaintext token found in personal_access_tokens table!');

        // Every token in personal_access_tokens must be a 64-character SHA-256 hash
        $storedTokens = DB::table('personal_access_tokens')
            ->where('tokenable_id', $user->id)
            ->get();

        $this->assertNotEmpty($storedTokens);
        foreach ($storedTokens as $stored) {
            $this->assertEquals(64, strlen($stored->token));
            $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/i', $stored->token);
            $this->assertNotNull($stored->expires_at);
        }
    }

    /**
     * Acceptance Test F: Token values are absent from logs, error responses, and session listings.
     */
    public function test_token_values_are_absent_from_session_listings_and_errors(): void
    {
        $user = $this->createCustomer([
            'email' => 'leak_check@example.com',
            'password' => Hash::make('SecurePass123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'SecurePass123!',
        ])->assertOk();

        $plainToken = $response->json('data.token');

        // Check session listing does not expose token secret or hash
        $sessionList = $this->withHeader('Authorization', 'Bearer ' . $plainToken)
            ->getJson('/api/v1/users/sessions')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($sessionList);
        foreach ($sessionList as $session) {
            $this->assertArrayNotHasKey('token', $session);
            $this->assertArrayNotHasKey('plainTextToken', $session);
            $this->assertArrayHasKey('device', $session);
            $this->assertArrayHasKey('expires_at', $session);
        }

        // Check 401 error response does not reflect or leak token
        $this->app['auth']->forgetGuards();
        $errorResponse = $this->withHeader('Authorization', 'Bearer invalid_secret_token_12345')
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->getContent();

        $this->assertStringNotContainsString('invalid_secret_token_12345', $errorResponse);
    }
}
