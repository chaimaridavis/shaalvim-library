"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { markAllRead } from "./actions";

export type Note = { id: string; message: string; link: string; when: string; isNew: boolean };

// Opening the list counts as seeing everything in it. The ones that were new
// stay highlighted until the member leaves the page.
export function NoteList({ notes }: { notes: Note[] }) {
  const [newIds] = useState(() => new Set(notes.filter((n) => n.isNew).map((n) => n.id)));
  const any = newIds.size > 0;
  useEffect(() => {
    if (any) markAllRead();
  }, [any]);

  return (
    <ul className="note-list">
      {notes.map((n) => (
        <li key={n.id} className={newIds.has(n.id) ? "note note-new" : "note"}>
          <Link href={n.link}>
            <span>{n.message}</span>
            <span className="muted small">{n.when}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
