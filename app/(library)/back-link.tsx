"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Goes back to where the member came from, or to the given page if they
// arrived directly.
export function BackLink({ label, fallback }: { label: string; fallback: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      className="back-link"
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}
