import { cn } from '@/lib/utils';

/**
 * Initials-only avatar — the app shows no profile photos anywhere for the
 * signed-in user (no <img>, no external photo URL, no generated/stock/AI
 * image). A plain neutral-grey circle with white initials.
 *
 * Initials come from firstName + lastName (e.g. "SB" for Somesh Biswal).
 * With only one name, the first two letters of that name are used. With no
 * name at all, the first letter of the email address is used.
 */
export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const first = (firstName || '').trim();
  const last = (lastName || '').trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  if (last) return last.slice(0, 2).toUpperCase();
  const local = (email || '').trim().split('@')[0];
  if (local) return local[0].toUpperCase();
  return '?';
}

interface InitialsAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  /** Size + colours, e.g. "h-9 w-9 text-sm". Defaults to a 36px circle. */
  className?: string;
  /** Accessible label; defaults to the full name, else the email. */
  label?: string;
}

export function InitialsAvatar({
  firstName,
  lastName,
  email,
  className,
  label,
}: InitialsAvatarProps) {
  const name =
    [firstName, lastName].filter(Boolean).join(' ').trim() || email || 'User';
  return (
    <span
      role="img"
      aria-label={label ?? name}
      title={name}
      className={cn(
        'flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-white',
        className,
      )}
    >
      {getInitials(firstName, lastName, email)}
    </span>
  );
}
