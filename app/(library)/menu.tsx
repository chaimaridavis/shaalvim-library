"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Browse" },
  { href: "/my-books", label: "My books" },
  { href: "/loans", label: "Loans" },
  { href: "/profile", label: "Profile" },
];

export function Menu({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...tabs, { href: "/approvals", label: "Approvals" }] : tabs;

  return (
    <nav className="menu" aria-label="Main menu">
      <ul>
        {items.map((tab) => {
          // Book and member pages are reached from Browse.
          const current =
            tab.href === "/"
              ? pathname === "/" || pathname.startsWith("/books") || pathname.startsWith("/members")
              : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-current={current ? "page" : undefined}>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
