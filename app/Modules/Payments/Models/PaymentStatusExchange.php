<?php

namespace App\Modules\Payments\Models;

use App\Modules\Orders\Models\Order;
use App\Modules\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentStatusExchange extends Model
{
    protected $table = 'payment_status_exchanges';

    protected $fillable = [
        'code_hash',
        'order_id',
        'order_number',
        'user_id',
        'purpose',
        'expires_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'order_id' => 'integer',
            'user_id' => 'integer',
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
