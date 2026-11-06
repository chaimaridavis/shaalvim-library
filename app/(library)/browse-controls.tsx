"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "./my-books/book-search";

const kinds = [
  { value: "", label: "All" },
  { value: "childrens", label: "Children's" },
  { value: "fiction", label: "Fiction" },
  { value: "nonfiction", label: "Non-fiction" },
];

export function BrowseControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");

  function go(change: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(change)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  // Search as the member types, after a short pause.
  useEffect(() => {
    if (text === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => go({ q: text.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text should trigger this
  }, [text]);

  const kind = params.get("kind") ?? "";

  return (
    <div className="stack">
      <form role="search" onSubmit={(e) => (e.preventDefault(), go({ q: text.trim() }))}>
        <div className="search-box">
          <SearchIcon />
          <input
            className="input"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search all books by title or author"
            aria-label="Search all books by title or author"
          />
        </div>
      </form>
      <div className="chips" role="group" aria-label="Kind of book">
        {kinds.map((k) => (
          <button
            key={k.value || "all"}
            type="button"
            className="chip"
            aria-pressed={kind === k.value}
            onClick={() => go({ kind: k.value })}
          >
            {k.label}
          </button>
        ))}
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={params.get("now") === "1"}
          onChange={(e) => go({ now: e.target.checked ? "1" : "" })}
        />
        Only show books I can borrow now
      </label>
    </div>
  );
}
