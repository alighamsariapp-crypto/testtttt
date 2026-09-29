<?php

namespace App\Modules\Auth\Models;

use Illuminate\Database\Eloquent\Model;

class PhoneVerificationCode extends Model
{
    protected $fillable = [
        'phone',
        'code_hash',
        'issued_at',
        'resend_available_at',
        'expires_at',
        'consumed_at',
        'attempts',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
            'resend_available_at' => 'datetime',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
            'attempts' => 'integer',
        ];
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }
}
