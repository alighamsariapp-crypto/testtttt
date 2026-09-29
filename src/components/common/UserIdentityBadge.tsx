import React from 'react';
import { UserRound } from 'lucide-react';

interface UserIdentityBadgeProps {
  name?: string | null;
  className?: string;
  iconClassName?: string;
}

/**
 * A privacy-friendly account marker used instead of uploaded or remote profile images.
 * The account name remains visible beside this icon in each consuming view.
 */
export const UserIdentityBadge: React.FC<UserIdentityBadgeProps> = ({
  name,
  className = 'w-11 h-11 rounded-2xl bg-blue-50 text-blue-600',
  iconClassName = 'w-5 h-5',
}) => (
  <div
    className={`${className} flex items-center justify-center shrink-0`}
    role="img"
    aria-label={`نماد حساب ${name?.trim() || 'کاربر'}`}
  >
    <UserRound className={iconClassName} aria-hidden="true" />
  </div>
);
