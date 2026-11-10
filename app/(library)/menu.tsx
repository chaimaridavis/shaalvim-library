"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "wide" tabs only fit in the top menu on computers; on phones the
// Numbers page is reached from Members.
const tabs: { href: string; label: string; wide?: boolean }[] = [
  { href: "/", label: "Browse" },
  { href: "/my-books", label: "My books" },
  { href: "/loans", label: "Loans" },
  { href: "/profile", label: "Profile" },
];

export function Menu({ isAdmin, bell }: { isAdmin: boolean; bell: React.ReactNode }) {
  const pathname = usePathname();
  const items = isAdmin ? [...tabs, { href: "/members", label: "Members" }, { href: "/numbers", label: "Numbers", wide: true }] : tabs;

  return (
    <nav className="menu" aria-label="Main menu">
      <div className="menu-inner">
      {/* Shown on computers, where the menu sits at the top. */}
      <Link href="/" className="menu-brand">
        Shaalvim Library
      </Link>
      <ul>
        {items.map((tab) => {
          // Book and member pages are reached from Browse.
          const current =
            tab.href === "/"
              ? pathname === "/" || pathname.startsWith("/books") || pathname.startsWith("/members/")
              : tab.href === "/members"
                ? pathname === "/members"
                : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className={tab.wide ? "wide-only" : undefined}>
              <Link href={tab.href} aria-current={current ? "page" : undefined}>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* On computers the bell sits at the end of the top menu. */}
      <div className="bell-in-menu">{bell}</div>
      </div>
    </nav>
  );
}
