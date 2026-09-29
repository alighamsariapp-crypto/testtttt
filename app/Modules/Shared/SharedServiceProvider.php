<?php

namespace App\Modules\Shared;

use Illuminate\Support\ServiceProvider;
use App\Modules\Shared\Helpers\RedactionHelper;

class SharedServiceProvider extends ServiceProvider
{
    /**
     * Register any Shared services, singletons and utilities.
     */
    public function register(): void
    {
        $this->app->singleton(RedactionHelper::class, function () {
            return new RedactionHelper(config('security.redacted_keys', []));
        });
    }

    /**
     * Bootstrap any Shared services.
     */
    public function boot(): void
    {
        // Shared foundational boot logic
    }
}
