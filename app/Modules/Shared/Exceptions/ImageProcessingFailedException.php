<?php

namespace App\Modules\Shared\Exceptions;

use Symfony\Component\HttpFoundation\Response;

class ImageProcessingFailedException extends DomainException
{
    protected string $errorCode = 'IMAGE_PROCESSING_FAILED';
    protected int $statusCode = Response::HTTP_UNPROCESSABLE_ENTITY; // 422
}
