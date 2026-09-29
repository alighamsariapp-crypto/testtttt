<?php

namespace App\Modules\Shared\Traits;

use App\Modules\Shared\Helpers\ApiResponseHelper;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

trait ApiResponseTrait
{
    protected function successResponse(mixed $data = null, string $message = 'Success', int $statusCode = Response::HTTP_OK): JsonResponse
    {
        return ApiResponseHelper::success($data, $message, $statusCode);
    }

    protected function errorResponse(
        string $message = 'Error',
        string $errorCode = 'GENERIC_ERROR',
        int $statusCode = Response::HTTP_BAD_REQUEST,
        mixed $errors = null
    ): JsonResponse {
        return ApiResponseHelper::error($message, $errorCode, $statusCode, $errors);
    }
}
