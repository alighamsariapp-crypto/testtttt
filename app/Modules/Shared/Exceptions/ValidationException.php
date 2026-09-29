<?php

namespace App\Modules\Shared\Exceptions;

use Symfony\Component\HttpFoundation\Response;

class ValidationException extends DomainException
{
    protected string $errorCode = 'VALIDATION_FAILED';
    protected int $statusCode = Response::HTTP_UNPROCESSABLE_ENTITY;
}
