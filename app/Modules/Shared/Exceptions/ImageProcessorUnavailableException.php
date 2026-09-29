<?php

namespace App\Modules\Shared\Exceptions;

use Symfony\Component\HttpFoundation\Response;

class ImageProcessorUnavailableException extends DomainException
{
    protected string $errorCode = 'IMAGE_PROCESSOR_UNAVAILABLE';
    protected int $statusCode = Response::HTTP_SERVICE_UNAVAILABLE; // 503
}
