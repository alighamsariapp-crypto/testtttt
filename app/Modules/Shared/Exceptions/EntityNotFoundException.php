<?php

namespace App\Modules\Shared\Exceptions;

use Symfony\Component\HttpFoundation\Response;

class EntityNotFoundException extends DomainException
{
    protected string $errorCode = 'ENTITY_NOT_FOUND';
    protected int $statusCode = Response::HTTP_NOT_FOUND;
}
