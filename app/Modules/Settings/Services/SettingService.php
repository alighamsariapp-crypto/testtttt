<?php

namespace App\Modules\Settings\Services;

use App\Modules\Settings\Models\Setting;
use App\Modules\Shared\Exceptions\EntityNotFoundException;

class SettingService
{
    private const ADMIN_GROUPS = [
        'appearance',
        'static_content',
        'blog_posts',
        'payment_gateways',
        'sms_config',
        'store_settings',
        'checkout_config',
    ];

    public function getAdminGroup(string $group): array
    {
        $this->ensureAdminGroup($group);

        return Setting::query()
            ->where('group', $group)
            ->orderBy('key')
            ->get()
            ->mapWithKeys(fn (Setting $setting): array => [str($setting->key)->after('.')->toString() => $setting->value])
            ->all();
    }

    public function putAdminGroup(string $group, array $settings): array
    {
        $this->ensureAdminGroup($group);

        foreach ($settings as $key => $value) {
            Setting::updateOrCreate(
                ['key' => $group.'.'.$key],
                [
                    'group' => $group,
                    'value' => $value,
                    'is_public' => in_array($group, ['appearance', 'static_content', 'blog_posts'], true),
                ]
            );
        }

        return $this->getAdminGroup($group);
    }

    public function getPublicGroups(): array
    {
        $groups = Setting::query()
            ->where('is_public', true)
            ->orderBy('group')
            ->orderBy('key')
            ->get()
            ->groupBy('group')
            ->map(fn ($settings): array => $settings
                ->mapWithKeys(fn (Setting $setting): array => [str($setting->key)->after('.')->toString() => $setting->value])
                ->all())
            ->all();

        if (isset($groups['blog_posts']['posts']) && is_array($groups['blog_posts']['posts'])) {
            $groups['blog_posts']['posts'] = array_values(array_filter(
                $groups['blog_posts']['posts'],
                fn ($post): bool => is_array($post) && (($post['isPublished'] ?? false) === true)
            ));
        }

        return $groups;
    }

    private function ensureAdminGroup(string $group): void
    {
        if (!in_array($group, self::ADMIN_GROUPS, true)) {
            throw new EntityNotFoundException('Settings group not found.');
        }
    }
}
