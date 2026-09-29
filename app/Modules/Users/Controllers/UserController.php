<?php

namespace App\Modules\Users\Controllers;

use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Users\Requests\AddressRequest;
use App\Modules\Users\Requests\UpdateProfileRequest;
use App\Modules\Users\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class UserController extends Controller
{
    public function __construct(private readonly UserService $userService)
    {
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('addresses');
        return ApiResponseHelper::success([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'email_verified' => $user->hasVerifiedEmail(),
            'phone_verified' => $user->hasVerifiedPhone(),
            'has_password' => $user->hasPassword(),
            'addresses' => $user->addresses,
            'created_at' => $user->created_at?->toIso8601String(),
        ], 'User profile retrieved successfully.');
    }

    public function updateMe(UpdateProfileRequest $request): JsonResponse
    {
        $updatedUser = $this->userService->updateProfile($request->user(), $request->validated());
        return ApiResponseHelper::success([
            'id' => $updatedUser->id,
            'name' => $updatedUser->name,
            'email' => $updatedUser->email,
            'phone' => $updatedUser->phone,
            'role' => $updatedUser->role,
            'status' => $updatedUser->status,
            'email_verified' => $updatedUser->hasVerifiedEmail(),
            'phone_verified' => $updatedUser->hasVerifiedPhone(),
            'has_password' => $updatedUser->hasPassword(),
        ], 'Profile updated successfully.');
    }

    public function getAddresses(Request $request): JsonResponse
    {
        return ApiResponseHelper::success($request->user()->addresses()->get(), 'Addresses retrieved.');
    }

    public function storeAddress(AddressRequest $request): JsonResponse
    {
        $address = $this->userService->addAddress($request->user(), $request->validated());
        return ApiResponseHelper::created($address, 'Address saved successfully.');
    }

    public function updateAddress(AddressRequest $request, int $id): JsonResponse
    {
        $address = $this->userService->updateAddress($request->user(), $id, $request->validated());
        return ApiResponseHelper::success($address, 'Address updated successfully.');
    }

    public function deleteAddress(Request $request, int $id): JsonResponse
    {
        $this->userService->deleteAddress($request->user(), $id);
        return ApiResponseHelper::success(null, 'Address deleted successfully.');
    }
}
