"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogBook } from "@/lib/catalog";
import { Cover } from "../../cover";

// A search box that shows matching catalog books as you type.
export function BookSearch({
  onPick,
  initial = "",
  autoFocus = false,
  placeholder = "Type a title or author",
}: {
  onPick: (book: CatalogBook) => void;
  initial?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(initial);
  const [results, setResults] = useState<CatalogBook[]>([]);
  const [state, setState] = useState<"idle" | "searching" | "done" | "failed">("idle");
  const latest = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return;
    const ticket = ++latest.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState("searching");
      try {
        const res = await fetch(`/api/catalog?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data: { books: CatalogBook[] } = await res.json();
        if (ticket !== latest.current) return;
        setResults(data.books ?? []);
        setState(res.ok ? "done" : "failed");
      } catch {
        if (ticket === latest.current && !controller.signal.aborted) setState("failed");
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  // Too short to search: show nothing, whatever the last search found.
  const active = text.trim().length >= 2;
  const shown = active ? results : [];
  const status = active ? state : "idle";

  return (
    <div>
      <div className="search-box">
        <SearchIcon />
        <input
          className="input"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="Search for a book by title or author"
          autoFocus={autoFocus}
        />
      </div>
      <div aria-live="polite">
        {status === "searching" && <p className="muted small" style={{ marginTop: 10 }}>Searching…</p>}
        {status === "failed" && (
          <p className="error" style={{ marginTop: 10 }}>
            The book catalog didn&rsquo;t answer. Please try again in a moment.
          </p>
        )}
        {status === "done" && shown.length === 0 && (
          <p className="muted small" style={{ marginTop: 10 }}>
            No books found. Try fewer words, or the author&rsquo;s surname.
          </p>
        )}
      </div>
      {shown.length > 0 && (
        <ul className="result-list">
          {shown.map((book) => (
            <li key={`${book.source}:${book.sourceId}`}>
              <button type="button" className="result" onClick={() => onPick(book)}>
                <Cover title={book.title} author={book.author} coverUrl={book.coverUrl} size="thumb" />
                <span>
                  <span className="book-name">{book.title}</span>
                  <span className="muted small">
                    {book.author || "Unknown author"}
                    {book.firstPublished ? ` · ${book.firstPublished}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SearchIcon() {
  return (
    <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
