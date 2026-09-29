<?php

namespace App\Modules\Shared\Exceptions;

use Exception;
use Symfony\Component\HttpFoundation\Response;

/**
 * Base Domain Exception
 */
class DomainException extends Exception
{
    protected string $errorCode = 'DOMAIN_ERROR';
    protected int $statusCode = Response::HTTP_BAD_REQUEST;

    public function __construct(string $message = '', ?string $errorCode = null, ?int $statusCode = null)
    {
        parent::__construct($message);

        if ($errorCode !== null) {
            $this->errorCode = $errorCode;
        }

        if ($statusCode !== null) {
            $this->statusCode = $statusCode;
        }
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}
