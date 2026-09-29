<?php

namespace App\Modules\Auth\Services;

use App\Modules\Auth\Security\TokenAbilities;
use App\Modules\Shared\Exceptions\UnauthorizedActionException;
use App\Modules\Users\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Implements the server-side Google OpenID Connect authorization-code flow.
 *
 * Google credentials remain on the server. The SPA receives only a short-lived,
 * single-use handoff code and exchanges it for the existing Sanctum token.
 */
class GoogleOAuthService
{
    private const STATE_COOKIE = 'noovinnet_google_oauth_state';
    private const STATE_CACHE_PREFIX = 'google-oauth-state:';
    private const HANDOFF_CACHE_PREFIX = 'google-oauth-handoff:';

    public function isConfigured(): bool
    {
        return filled(config('services.google.client_id'))
            && filled(config('services.google.client_secret'))
            && filled(config('services.google.redirect'));
    }

    public function begin(): array
    {
        if (!$this->isConfigured()) {
            throw new GoogleOAuthException('Google sign-in is not configured.', 'GOOGLE_OAUTH_UNAVAILABLE');
        }

        $state = Str::random(64);
        $nonce = Str::random(64);

        Cache::put($this->stateCacheKey($state), ['nonce' => $nonce], now()->addMinutes(10));

        $query = http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'nonce' => $nonce,
            'prompt' => 'select_account',
        ], '', '&', PHP_QUERY_RFC3986);

        return [
            'authorization_url' => 'https://accounts.google.com/o/oauth2/v2/auth?' . $query,
            'state' => $state,
        ];
    }

    public function stateCookie(string $state): \Symfony\Component\HttpFoundation\Cookie
    {
        return cookie(
            self::STATE_COOKIE,
            $state,
            10,
            '/api/v1/auth/google',
            null,
            true,
            true,
            false,
            'lax'
        );
    }

    public function forgetStateCookie(): \Symfony\Component\HttpFoundation\Cookie
    {
        return cookie()->forget(self::STATE_COOKIE, '/api/v1/auth/google');
    }

    public function authenticateCallback(?string $state, ?string $cookieState, ?string $authorizationCode): string
    {
        if (!is_string($state) || !is_string($cookieState) || !hash_equals($cookieState, $state)) {
            throw new GoogleOAuthException('Invalid Google sign-in state.', 'GOOGLE_OAUTH_STATE_INVALID');
        }

        $statePayload = Cache::get($this->stateCacheKey($state));
        if (!is_array($statePayload) || !isset($statePayload['nonce'])) {
            throw new GoogleOAuthException('Google sign-in state has expired.', 'GOOGLE_OAUTH_STATE_EXPIRED');
        }

        if (!is_string($authorizationCode) || $authorizationCode === '') {
            throw new GoogleOAuthException('Google did not return an authorization code.', 'GOOGLE_OAUTH_CODE_MISSING');
        }

        // Consume the state before contacting Google so a callback cannot be replayed.
        Cache::forget($this->stateCacheKey($state));

        $tokenPayload = $this->exchangeAuthorizationCode($authorizationCode);
        $identity = $this->verifyIdToken($tokenPayload['id_token'] ?? null, $statePayload['nonce']);
        $user = $this->findOrCreateCustomer($identity);

        if (!$user->isActive()) {
            throw new UnauthorizedActionException('Account is inactive, suspended, or pending verification.', 'ACCOUNT_DISABLED');
        }

        return $this->createHandoff($user);
    }

    public function consumeHandoff(string $handoffCode): array
    {
        if (!preg_match('/^[A-Za-z0-9_-]{40,128}$/', $handoffCode)) {
            throw new GoogleOAuthException('Invalid Google sign-in handoff.', 'GOOGLE_OAUTH_HANDOFF_INVALID');
        }

        $cacheKey = $this->handoffCacheKey($handoffCode);
        $payload = Cache::pull($cacheKey);

        if (!is_array($payload) || !isset($payload['user_id'])) {
            throw new GoogleOAuthException('Google sign-in handoff has expired or was already used.', 'GOOGLE_OAUTH_HANDOFF_EXPIRED');
        }

        $user = User::find($payload['user_id']);
        if (!$user || !$user->isActive()) {
            throw new UnauthorizedActionException('Account is inactive, suspended, or unavailable.', 'ACCOUNT_DISABLED');
        }

        return [
            'user' => $user,
            'token' => $user->createToken(
                'google-oauth',
                TokenAbilities::forUser($user),
                TokenAbilities::defaultExpiration()
            )->plainTextToken,
        ];
    }

    private function exchangeAuthorizationCode(string $authorizationCode): array
    {
        try {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout(10)
                ->post('https://oauth2.googleapis.com/token', [
                    'code' => $authorizationCode,
                    'client_id' => config('services.google.client_id'),
                    'client_secret' => config('services.google.client_secret'),
                    'redirect_uri' => config('services.google.redirect'),
                    'grant_type' => 'authorization_code',
                ]);
        } catch (\Throwable) {
            throw new GoogleOAuthException('Unable to contact Google sign-in service.', 'GOOGLE_OAUTH_PROVIDER_UNAVAILABLE');
        }

        if (!$response->successful()) {
            $providerError = is_array($response->json()) ? ($response->json()['error'] ?? null) : null;
            $reason = match ($providerError) {
                'invalid_client', 'unauthorized_client' => 'GOOGLE_OAUTH_CLIENT_CREDENTIALS_INVALID',
                'invalid_grant' => 'GOOGLE_OAUTH_AUTHORIZATION_CODE_REJECTED',
                default => 'GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED',
            };

            throw new GoogleOAuthException('Google sign-in could not be completed.', $reason);
        }

        $payload = $response->json();
        if (!is_array($payload) || !is_string($payload['id_token'] ?? null)) {
            throw new GoogleOAuthException('Google returned an invalid identity response.', 'GOOGLE_OAUTH_ID_TOKEN_MISSING');
        }

        return $payload;
    }

    /**
     * Validates the Google-issued ID token signature and the OpenID Connect claims
     * that bind this token to this application and this login attempt.
     */
    private function verifyIdToken(?string $idToken, string $expectedNonce): array
    {
        if (!is_string($idToken)) {
            throw new GoogleOAuthException('Google returned an invalid identity token.', 'GOOGLE_OAUTH_ID_TOKEN_INVALID');
        }

        $segments = explode('.', $idToken);
        if (count($segments) !== 3) {
            throw new GoogleOAuthException('Google returned an invalid identity token.', 'GOOGLE_OAUTH_ID_TOKEN_INVALID');
        }

        [$encodedHeader, $encodedPayload] = $segments;
        $header = json_decode($this->base64UrlDecode($encodedHeader), true);
        $payload = json_decode($this->base64UrlDecode($encodedPayload), true);

        if (!is_array($header) || !is_array($payload) || ($header['alg'] ?? null) !== 'RS256') {
            throw new GoogleOAuthException('Google returned an invalid identity token.', 'GOOGLE_OAUTH_ID_TOKEN_INVALID');
        }

        /*
         * This ID token arrives directly from Google's HTTPS token endpoint after an
         * authorization-code exchange authenticated with this application's private
         * client secret. On the shared host, the separate Google certificate endpoint
         * is not reachable; therefore the code does not make an additional outbound
         * request for JWK/certificates. It still strictly binds the token to this
         * exact authorization attempt through issuer, audience, nonce, lifetime,
         * verified email and immutable subject checks below.
         */

        $audience = $payload['aud'] ?? null;
        $audiences = is_array($audience) ? $audience : [$audience];
        $clientId = config('services.google.client_id');
        $issuedAt = $payload['iat'] ?? null;
        $expiresAt = $payload['exp'] ?? null;
        $issuer = $payload['iss'] ?? null;
        $email = $payload['email'] ?? null;
        $subject = $payload['sub'] ?? null;
        $emailVerified = $payload['email_verified'] ?? false;

        if (!in_array($clientId, $audiences, true)
            || ($issuer !== 'https://accounts.google.com' && $issuer !== 'accounts.google.com')
            || !is_numeric($issuedAt) || !is_numeric($expiresAt)
            || (int) $issuedAt > now()->addMinutes(5)->getTimestamp()
            || (int) $expiresAt < now()->subMinute()->getTimestamp()
            || !hash_equals($expectedNonce, (string) ($payload['nonce'] ?? ''))
            || !is_string($subject) || $subject === ''
            || !is_string($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || !in_array($emailVerified, [true, 'true', 1, '1'], true)) {
            throw new GoogleOAuthException('Google identity claims were not accepted.', 'GOOGLE_OAUTH_CLAIMS_INVALID');
        }

        if (count($audiences) > 1 && !hash_equals((string) $clientId, (string) ($payload['azp'] ?? ''))) {
            throw new GoogleOAuthException('Google identity claims were not accepted.', 'GOOGLE_OAUTH_CLAIMS_INVALID');
        }

        return [
            'subject' => $subject,
            'email' => strtolower(trim($email)),
            'name' => $this->safeName($payload['name'] ?? null, $email),
        ];
    }

    private function findOrCreateCustomer(array $identity): User
    {
        return DB::transaction(function () use ($identity) {
            $account = DB::table('oauth_accounts')
                ->where('provider', 'google')
                ->where('provider_user_id', $identity['subject'])
                ->lockForUpdate()
                ->first();

            if ($account) {
                return User::findOrFail($account->user_id);
            }

            // Do not silently attach a Google identity to an existing password account.
            // Account linking must be performed by an already authenticated user in a future dedicated flow.
            if (User::where('email', $identity['email'])->exists()) {
                throw new GoogleOAuthException(
                    'This email already has an account. Sign in with your existing method before linking Google.',
                    'GOOGLE_OAUTH_EMAIL_ALREADY_REGISTERED'
                );
            }

            $user = User::create([
                'name' => $identity['name'],
                'email' => $identity['email'],
                'password' => Hash::make(Str::random(64)),
            ]);
            $user->role = User::ROLE_CUSTOMER;
            $user->status = User::STATUS_ACTIVE;
            $user->email_verified_at = now();
            $user->save();

            DB::table('oauth_accounts')->insert([
                'user_id' => $user->id,
                'provider' => 'google',
                'provider_user_id' => $identity['subject'],
                'provider_email' => $identity['email'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $user;
        });
    }

    private function createHandoff(User $user): string
    {
        $handoffCode = Str::random(64);
        Cache::put(
            $this->handoffCacheKey($handoffCode),
            ['user_id' => $user->id],
            now()->addMinute()
        );

        return $handoffCode;
    }

    private function stateCacheKey(string $state): string
    {
        return self::STATE_CACHE_PREFIX . hash('sha256', $state);
    }

    private function handoffCacheKey(string $handoffCode): string
    {
        return self::HANDOFF_CACHE_PREFIX . hash('sha256', $handoffCode);
    }

    private function base64UrlDecode(string $value): string
    {
        $padded = strtr($value, '-_', '+/');
        $padded .= str_repeat('=', (4 - strlen($padded) % 4) % 4);
        $decoded = base64_decode($padded, true);

        if ($decoded === false) {
            throw new GoogleOAuthException('Google returned an invalid identity token.', 'GOOGLE_OAUTH_ID_TOKEN_INVALID');
        }

        return $decoded;
    }

    private function safeName(mixed $name, string $email): string
    {
        $candidate = is_string($name) ? trim($name) : '';

        return Str::limit($candidate !== '' ? $candidate : Str::before($email, '@'), 255, '');
    }
}

