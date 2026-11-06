"use client";

import { useState, useTransition } from "react";
import { Cover } from "../../cover";
import { removeCopy } from "./actions";

export type ShelfItem = {
  copyId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  statusText: string;
  warning: boolean;
};

function ShelfRow({ item }: { item: ShelfItem }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li className="shelf-row">
      <Cover title={item.title} author={item.author} coverUrl={item.coverUrl} size="thumb" />
      <div className="shelf-text">
        <span className="book-name">{item.title}</span>
        <span className={item.warning ? "warning small" : "muted small"}>{item.statusText}</span>
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
