<?php

namespace App\Modules\Auth\Controllers;

use App\Modules\Auth\Requests\ChangePasswordRequest;
use App\Modules\Auth\Requests\ForgotPasswordRequest;
use App\Modules\Auth\Requests\LoginRequest;
use App\Modules\Auth\Requests\RegisterRequest;
use App\Modules\Auth\Requests\ResetPasswordRequest;
use App\Modules\Auth\Requests\ConfirmSmsPasswordResetRequest;
use App\Modules\Auth\Requests\SendSmsPasswordResetCodeRequest;
use App\Modules\Auth\Requests\SendPhoneVerificationCodeRequest;
use App\Modules\Auth\Requests\VerifyPhoneVerificationCodeRequest;
use App\Modules\Auth\Services\AuthService;
use App\Modules\Auth\Services\PhoneOtpService;
use App\Modules\Auth\Services\SmsPasswordResetService;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Users\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Password;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly PhoneOtpService $phoneOtpService,
        private readonly SmsPasswordResetService $smsPasswordResetService,
    ) {
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return ApiResponseHelper::created([
            'user' => $this->serializeUser($result['user']),
            'token' => $result['token'],
        ], 'User account created successfully.');
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login(
            $request->validated('email'),
            $request->validated('password'),
            $request->validated('device_name')
        );

        return ApiResponseHelper::success([
            'user' => $this->serializeUser($result['user']),
            'token' => $result['token'],
        ], 'Logged in successfully.');
    }

    public function sendPhoneVerificationCode(SendPhoneVerificationCodeRequest $request): JsonResponse
    {
        $result = $this->phoneOtpService->send($request->validated('phone'));

        return ApiResponseHelper::success($result, 'Verification code dispatched successfully.');
    }

    public function verifyPhoneVerificationCode(VerifyPhoneVerificationCodeRequest $request): JsonResponse
    {
        $result = $this->phoneOtpService->verify(
            $request->validated('phone'),
            $request->validated('code'),
            $request->validated('device_name')
        );

        return ApiResponseHelper::success([
            'user' => $this->serializeUser($result['user']),
            'token' => $result['token'],
            'is_new_user' => $result['is_new_user'],
        ], $result['is_new_user'] ? 'Account created and phone verified successfully.' : 'Signed in successfully.');
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user(), $request->bearerToken());
        return ApiResponseHelper::success(null, 'Logged out successfully.');
    }

    public function me(Request $request): JsonResponse
    {
        return ApiResponseHelper::success(
            $this->serializeUser($request->user()),
            'Authenticated user profile retrieved.'
        );
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->authService->changePassword(
            $request->user(),
            (string) ($request->validated('current_password') ?? ''),
            $request->validated('password'),
            $request->bearerToken()
        );

        return ApiResponseHelper::success(null, 'Password updated successfully.');
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        // Safe response to prevent account enumeration
        $this->authService->sendPasswordResetLink($request->validated('email'));

        return ApiResponseHelper::success(null, 'If an account exists with this email, a password reset link has been dispatched.');
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = $this->authService->resetPassword($request->validated());

        if ($status === Password::PASSWORD_RESET) {
            return ApiResponseHelper::success(null, __($status));
        }

        return ApiResponseHelper::error(__($status), 'PASSWORD_RESET_FAILED', Response::HTTP_BAD_REQUEST);
    }

    public function sendSmsPasswordResetCode(SendSmsPasswordResetCodeRequest $request): JsonResponse
    {
        $result = $this->smsPasswordResetService->send($request->validated('phone'));

        return ApiResponseHelper::success($result, 'If an eligible account exists, a password recovery code has been sent.');
    }

    public function confirmSmsPasswordReset(ConfirmSmsPasswordResetRequest $request): JsonResponse
    {
        $result = $this->smsPasswordResetService->reset(
            $request->validated('phone'),
            $request->validated('code'),
            $request->validated('password'),
            $request->validated('device_name')
        );

        return ApiResponseHelper::success([
            'user' => $this->serializeUser($result['user']),
            'token' => $result['token'],
        ], 'Password reset successfully.');
    }

    public function verifyEmail(Request $request, int $id, string $hash): JsonResponse
    {
        $user = User::findOrFail($id);

        if (!$user->email || !hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            return ApiResponseHelper::error('Invalid email verification signature.', 'INVALID_VERIFICATION_LINK', Response::HTTP_FORBIDDEN);
        }

        if ($user->hasVerifiedEmail()) {
            return ApiResponseHelper::success(null, 'Email already verified.');
        }

        if ($user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return ApiResponseHelper::success(null, 'Email verified successfully.');
    }

    public function resendVerificationEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->email) {
            return ApiResponseHelper::error('Add an email address before requesting email verification.', 'EMAIL_REQUIRED', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($user->hasVerifiedEmail()) {
            return ApiResponseHelper::success(null, 'Email already verified.');
        }

        $user->sendEmailVerificationNotification();

        return ApiResponseHelper::success(null, 'Verification notification dispatched.');
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'email_verified' => $user->hasVerifiedEmail(),
            'phone_verified' => $user->hasVerifiedPhone(),
            'has_password' => $user->hasPassword(),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
