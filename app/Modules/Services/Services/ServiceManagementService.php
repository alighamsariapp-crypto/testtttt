<?php

namespace App\Modules\Services\Services;

use App\Modules\Services\Models\ServiceCatalog;
use App\Modules\Services\Models\ServiceCategory;
use App\Modules\Services\Models\ServiceQuote;
use App\Modules\Services\Models\ServiceRequest;
use App\Modules\Shared\Contracts\BaseServiceInterface;
use App\Modules\Shared\Exceptions\DomainException;
use App\Modules\Shared\Exceptions\EntityNotFoundException;
use App\Modules\Users\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ServiceManagementService implements BaseServiceInterface
{
    private const CACHE_KEY_SERVICES = 'services:catalog:active';

    public function getActiveServices(): Collection
    {
        return Cache::remember(self::CACHE_KEY_SERVICES, 3600, function () {
            return $this->publicServicesQuery()->get();
        });
    }

    public function findServiceBySlug(string $slug): ServiceCatalog
    {
        $service = $this->publicServicesQuery()->where('slug', $slug)->first();
        if (!$service) {
            throw new EntityNotFoundException("Service '{$slug}' not found.");
        }
        return $service;
    }

    public function createCustomerRequest(User $user, array $data): ServiceRequest
    {
        return DB::transaction(function () use ($user, $data) {
            $requestNumber = 'SRV-'.date('Ymd').'-'.strtoupper(Str::random(6));

            $serviceRequest = ServiceRequest::create([
                'request_number' => $requestNumber,
                'user_id' => $user->id,
                'service_catalog_id' => $data['service_catalog_id'] ?? null,
                'title' => $data['title'],
                'requirements' => $data['requirements'],
                'status' => ServiceRequest::STATUS_SUBMITTED,
                'custom_attributes' => $data['custom_attributes'] ?? null,
                'attachments' => $data['attachments'] ?? null,
            ]);

            return $serviceRequest->load(['catalog', 'user:id,name,email']);
        });
    }

    public function getCustomerRequests(User $user, int $perPage = 15): LengthAwarePaginator
    {
        return ServiceRequest::where('user_id', $user->id)
            ->with(['catalog', 'quotes', 'timelines'])
            ->orderBy('created_at', 'desc')
            ->paginate(min(max($perPage, 1), 50));
    }

    public function findCustomerRequest(User $user, string|int $requestIdOrNumber): ServiceRequest
    {
        $query = ServiceRequest::where('user_id', $user->id)->with(['catalog', 'quotes', 'timelines']);

        $request = is_numeric($requestIdOrNumber)
            ? $query->where('id', (int) $requestIdOrNumber)->first()
            : $query->where('request_number', $requestIdOrNumber)->first();

        if (!$request) {
            throw new EntityNotFoundException('Service request not found or access is denied.');
        }

        return $request;
    }

    public function respondToQuote(User $user, int $quoteId, string $action): ServiceQuote
    {
        return DB::transaction(function () use ($user, $quoteId, $action) {
            $quote = ServiceQuote::with('serviceRequest')->find($quoteId);
            if (!$quote || $quote->serviceRequest->user_id !== $user->id) {
                throw new EntityNotFoundException('Service quote not found or access is denied.');
            }

            if ($quote->status !== ServiceQuote::STATUS_PENDING) {
                throw new DomainException('Quote has already been responded to or expired.', 'INVALID_QUOTE_STATUS', 400);
            }

            if ($action === 'accept') {
                $quote->status = ServiceQuote::STATUS_ACCEPTED;
                $quote->responded_at = now();
                $quote->save();

                $quote->serviceRequest->status = ServiceRequest::STATUS_CUSTOMER_ACCEPTED;
                $quote->serviceRequest->save();
            } elseif ($action === 'reject') {
                $quote->status = ServiceQuote::STATUS_REJECTED;
                $quote->responded_at = now();
                $quote->save();

                $quote->serviceRequest->status = ServiceRequest::STATUS_REVIEWING;
                $quote->serviceRequest->save();
            } else {
                throw new DomainException("Invalid action: {$action}. Must be 'accept' or 'reject'.", 'INVALID_ACTION', 400);
            }

            return $quote->fresh();
        });
    }

    public function invalidateCache(): void
    {
        Cache::forget(self::CACHE_KEY_SERVICES);
    }

    public function getActiveServiceCategories(): Collection
    {
        if (! Schema::hasTable('service_categories') || ! Schema::hasColumn('service_catalogs', 'service_category_id')) {
            return new Collection();
        }

        return ServiceCategory::query()
            ->where('is_active', true)
            ->whereHas('services', fn ($query) => $query->where('is_active', true))
            ->withCount(['services as services_count' => fn ($query) => $query->where('is_active', true)])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    private function publicServicesQuery()
    {
        $query = ServiceCatalog::query()->where('is_active', true);

        if (Schema::hasTable('service_categories') && Schema::hasColumn('service_catalogs', 'service_category_id')) {
            $query->whereHas('serviceCategory', fn ($category) => $category->where('is_active', true))
                ->with('serviceCategory:id,name,slug');
        }

        return $query;
    }
}
