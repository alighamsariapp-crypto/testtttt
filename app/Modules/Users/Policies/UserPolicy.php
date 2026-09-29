<?php

namespace App\Modules\Users\Policies;

use App\Modules\Users\Models\User;
use App\Modules\Users\Models\UserAddress;

class UserPolicy
{
    public function view(User $actor, User $target): bool
    {
        return $actor->id === $target->id || $actor->isAdmin() || $actor->isStaff();
    }

    public function update(User $actor, User $target): bool
    {
        return $actor->id === $target->id || $actor->isAdmin();
    }

    public function manageAddress(User $actor, UserAddress $address): bool
    {
        return $actor->id === $address->user_id || $actor->isAdmin();
    }
}
