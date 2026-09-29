<?php

namespace App\Modules\Settings\Controllers;

use App\Modules\Shared\Exceptions\ImageProcessingFailedException;
use App\Modules\Shared\Exceptions\ImageProcessorUnavailableException;
use App\Modules\Shared\Helpers\ApiResponseHelper;
use App\Modules\Shared\Services\SafeImageUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * Handles secure blog image uploads stored in 'uploads'.DIRECTORY_SEPARATOR.'blog'
 * via centralized SafeImageUploadService.
 */
class BlogImageUploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file'],
        ]);

        try {
            $result = SafeImageUploadService::processAndStore(
                $request->file('image'),
                'blog',
                6291456 // 6MB
            );

            return ApiResponseHelper::created([
                'url' => $result['url'],
                'filename' => $result['filename'],
            ], 'Blog image uploaded successfully.');
        } catch (ImageProcessorUnavailableException $e) {
            return ApiResponseHelper::error(
                $e->getMessage() ?: 'Image processor service is unavailable.',
                $e->getErrorCode(),
                $e->getStatusCode()
            );
        } catch (ImageProcessingFailedException $e) {
            return ApiResponseHelper::error(
                $e->getMessage() ?: 'Image processing and re-encoding failed.',
                $e->getErrorCode(),
                $e->getStatusCode()
            );
        }
    }
}
