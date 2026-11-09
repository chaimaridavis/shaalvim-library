"use client";

import { useState, useTransition } from "react";
import { Cover } from "../../cover";
import type { Genre } from "@/lib/genres";
import { removeCopy, setGenre } from "./actions";
import { GenrePicker } from "./genre-picker";

export type ShelfItem = {
  copyId: string;
  bookId: string;
  genre: Genre | null;
  title: string;
  author: string;
  coverUrl: string | null;
  statusText: string;
  warning: boolean;
};

function ShelfRow({ item }: { item: ShelfItem }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [genre, setGenreValue] = useState(item.genre);
  const [saving, startSaving] = useTransition();

  return (
    <li className="shelf-row">
      <Cover title={item.title} author={item.author} coverUrl={item.coverUrl} size="thumb" />
      <div className="shelf-text">
        <span className="book-name">{item.title}</span>
        <span className={item.warning ? "warning small" : "muted small"}>{item.statusText}</span>
        <GenrePicker
          value={genre}
          label={`Genre for ${item.title}`}
          disabled={saving}
          onChange={(g) => {
            setGenreValue(g);
            startSaving(async () => {
              await setGenre(item.bookId, g);
            });
          }}
        />
      </div>
      {confirming ? (
        <div className="confirm">
          <span className="small">Remove it?</span>
          <button
            type="button"
            className="button small-button"
            disabled={pending}
            onClick={() => startTransition(() => removeCopy(item.copyId))}
          >
            {pending ? "Removing…" : "Yes, remove"}
          </button>
          <button
            type="button"
            className="button secondary small-button"
            disabled={pending}
            onClick={() => setConfirming(false)}
          >
            Keep
          </button>
        </div>
      ) : (
        <button type="button" className="button secondary small-button" onClick={() => setConfirming(true)}>
          Remove
        </button>
      )}
    </li>
  );
}

export function Shelf({ items }: { items: ShelfItem[] }) {
  if (!items.length) {
    return <p className="muted">Your shelf is empty. Add your first book above.</p>;
  }
  return (
    <ul className="shelf">
      {items.map((item) => (
        <ShelfRow key={item.copyId} item={item} />
      ))}
    </ul>
  );
}
