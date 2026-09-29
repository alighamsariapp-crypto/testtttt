<?php

namespace App\Modules\Shared\Exceptions;

use Symfony\Component\HttpFoundation\Response;

class UnauthorizedActionException extends DomainException
{
    protected string $errorCode = 'FORBIDDEN_ACTION';
    protected int $statusCode = Response::HTTP_FORBIDDEN;
}
