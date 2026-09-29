<?php

namespace App\Modules\Shared\Exceptions;

use Symfony\Component\HttpFoundation\Response;

class BusinessRuleException extends DomainException
{
    protected string $errorCode = 'BUSINESS_RULE_VIOLATION';
    protected int $statusCode = Response::HTTP_BAD_REQUEST;
}
