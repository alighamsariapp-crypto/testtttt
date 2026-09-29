<?php

return [
    // Production default: File cache on NVMe (No Redis dependency)
    'default' => env('CACHE_STORE', 'file'),

    'stores' => [
        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],

        'database' => [
            'driver' => 'database',
            'table' => env('DB_CACHE_TABLE', 'cache'),
            'lock_table' => env('DB_CACHE_LOCK_TABLE', 'cache_locks'),
            'connection' => env('DB_CACHE_CONNECTION', null),
            'lock_connection' => env('DB_CACHE_LOCK_CONNECTION', null),
        ],

        'file' => [
            'driver' => 'file',
            'path' => storage_path('framework/cache/data'),
            'lock_path' => storage_path('framework/cache/data'),
        ],
    ],

    'prefix' => env('CACHE_PREFIX', 'apexstore_cache_'),
];
