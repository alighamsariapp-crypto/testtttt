<?php

namespace App\Modules\Auth\Services;

use RuntimeException;

class GoogleOAuthException extends RuntimeException
{
    public function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }
}
