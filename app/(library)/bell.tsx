import Link from "next/link";

// The bell, with how many notifications are new.
export function Bell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      className="bell"
      aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M10 20.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {unread > 0 && <span className="bell-count">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
