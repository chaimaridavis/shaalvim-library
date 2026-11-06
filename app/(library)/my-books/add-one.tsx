"use client";

import { useState, useTransition } from "react";
import type { CatalogBook, Category } from "@/lib/catalog";
import { Cover } from "../../cover";
import { addBooks } from "./actions";
import { BookSearch } from "./book-search";
import { CategoryPicker } from "./category-picker";

export function AddOne() {
  const [key, setKey] = useState(0);
  const [needsCategory, setNeedsCategory] = useState<CatalogBook | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function add(book: CatalogBook, category: Category | null) {
    startTransition(async () => {
      const result = await addBooks([{ book, category }]);
      setNeedsCategory(null);
      if (result.error) setMessage({ text: result.error, error: true });
      else if (result.alreadyOnShelf) setMessage({ text: `${book.title} is already on your shelf.` });
      else setMessage({ text: `Added ${book.title} to your shelf.` });
      setKey((k) => k + 1);
    });
  }

  function pick(book: CatalogBook) {
    setMessage(null);
    if (book.category) add(book, book.category);
    else setNeedsCategory(book);
  }

  return (
    <div>
      <h2 className="card-heading">Add one book</h2>
      {needsCategory ? (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="row">
            <Cover
              title={needsCategory.title}
              author={needsCategory.author}
              coverUrl={needsCategory.coverUrl}
              size="thumb"
            />
            <div>
              <p className="book-name">{needsCategory.title}</p>
              <p className="muted small">{needsCategory.author}</p>
            </div>
          </div>
          <p>What kind of book is it?</p>
          <CategoryPicker
            value={null}
            label={`Kind of book for ${needsCategory.title}`}
            onChange={(c) => add(needsCategory, c)}
          />
          <button type="button" className="text-link" onClick={() => setNeedsCategory(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <BookSearch key={key} onPick={pick} />
        </div>
      )}
      <div aria-live="polite">
        {pending && <p className="muted small" style={{ marginTop: 10 }}>Adding…</p>}
        {message && !pending && (
          <p className={message.error ? "error" : "notice"} style={{ marginTop: 12 }}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
