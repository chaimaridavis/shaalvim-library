"use client";

import { useState, useTransition } from "react";
import type { CatalogBook, Category } from "@/lib/catalog";
import type { Genre } from "@/lib/genres";
import { Cover } from "../../cover";
import { addBooks, findList } from "./actions";
import { BookSearch } from "./book-search";
import { CategoryPicker } from "./category-picker";
import { GenrePicker } from "./genre-picker";

type Row = {
  key: number;
  line: string;
  title: string;
  book: CatalogBook | null;
  confident: boolean;
  checked: boolean;
  category: Category | null;
  genre: Genre | null;
  changing: boolean;
};

const plural = (n: number) => `${n} ${n === 1 ? "book" : "books"}`;

export function PasteList() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tooMany, setTooMany] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [finding, startFinding] = useTransition();
  const [adding, startAdding] = useTransition();

  function find() {
    setMessage(null);
    startFinding(async () => {
      const found = await findList(text);
      setTooMany(Boolean(found.tooMany));
      setRows(
        found.matches.map((m, i) => ({
          key: i,
          line: m.line,
          title: m.title,
          book: m.book,
          confident: m.confident,
          checked: Boolean(m.book),
          category: m.book?.category ?? null,
          genre: m.book?.genre ?? null,
          changing: false,
        })),
      );
    });
  }

  function update(key: number, change: Partial<Row>) {
    setRows((current) => current?.map((r) => (r.key === key ? { ...r, ...change } : r)) ?? null);
  }

  const matched = rows?.filter((r) => r.book) ?? [];
  const unmatched = rows?.filter((r) => !r.book) ?? [];
  const chosen = matched.filter((r) => r.checked);
  const missingKind = chosen.filter((r) => !r.category).length;

  function add() {
    startAdding(async () => {
      const result = await addBooks(chosen.map((r) => ({ book: r.book!, category: r.category, genre: r.genre })));
      if (result.error) {
        setMessage({ text: result.error, error: true });
        return;
      }
      const already = result.alreadyOnShelf
        ? ` ${plural(result.alreadyOnShelf)} ${result.alreadyOnShelf === 1 ? "was" : "were"} already there.`
        : "";
      setMessage({ text: `Added ${plural(result.added)} to your shelf.${already}` });
      const left = unmatched.map((r) => r.line).join("\n");
      setText(left);
      setRows(null);
    });
  }

  function changePanel(row: Row) {
    return (
      <div className="change-panel">
        <BookSearch
          autoFocus
          initial={row.title}
          onPick={(book) =>
            update(row.key, {
              book,
              confident: true,
              checked: true,
              category: book.category,
              genre: book.genre,
              changing: false,
            })
          }
        />
        <button type="button" className="text-link" onClick={() => update(row.key, { changing: false })}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="card-heading">Add several books</h2>
      <label htmlFor="book-list" className="muted small" style={{ display: "block", marginTop: 6 }}>
        Paste a list of your books, one per line. Title and author is enough.
      </label>
      <textarea
        id="book-list"
        className="input textarea"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"The Night Circus, Erin Morgenstern\nWonder by R.J. Palacio\nThe Book Thief"}
      />
      <button
        type="button"
        className="button full"
        style={{ marginTop: 12 }}
        onClick={find}
        disabled={finding || text.trim().length < 2}
      >
        {finding ? "Looking up your books…" : "Find these books"}
      </button>

      <div aria-live="polite">
        {message && (
          <p className={message.error ? "error" : "notice"} style={{ marginTop: 12 }}>
            {message.text}
          </p>
        )}
      </div>

      {rows && (
        <section className="matches" aria-label="Books we found">
          <div className="matches-head">
            <h2>
              We matched {matched.length} of {rows.length}
            </h2>
            {matched.length > 0 && <span className="muted small">Uncheck any that are wrong</span>}
          </div>
          {tooMany && (
            <p className="muted small">
              We looked up the first 60 lines. Add these, then paste the rest.
            </p>
          )}

          <ul className="match-list">
            {matched.map((row) => (
              <li key={row.key}>
                <div className="match">
                  <input
                    type="checkbox"
                    className="tick"
                    checked={row.checked}
                    onChange={(e) => update(row.key, { checked: e.target.checked })}
                    aria-label={`Add ${row.book!.title}`}
                  />
                  <Cover
                    title={row.book!.title}
                    author={row.book!.author}
                    coverUrl={row.book!.coverUrl}
                    size="thumb"
                  />
                  <div className="match-text">
                    <span className="book-name">{row.book!.title}</span>
                    <span className="muted small">{row.book!.author || "Unknown author"}</span>
                    {!row.confident && (
                      <span className="warning small">Not sure about this one. Please check.</span>
                    )}
                    <CategoryPicker
                      value={row.category}
                      label={`Kind of book for ${row.book!.title}`}
                      onChange={(c) => update(row.key, { category: c })}
                    />
                    <GenrePicker
                      value={row.genre}
                      label={`Genre for ${row.book!.title}`}
                      onChange={(g) => update(row.key, { genre: g })}
                    />
                  </div>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => update(row.key, { changing: !row.changing })}
                  >
                    Change
                  </button>
                </div>
                {row.changing && changePanel(row)}
              </li>
            ))}
          </ul>

          {unmatched.map((row) => (
            <div key={row.key} className="not-found">
              <div className="not-found-row">
                <span>We couldn&rsquo;t find &ldquo;{row.line}.&rdquo;</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => update(row.key, { changing: !row.changing })}
                >
                  Change
                </button>
              </div>
              {row.changing && changePanel(row)}
            </div>
          ))}

          {missingKind > 0 && (
            <p className="warning small" style={{ marginTop: 12 }}>
              Please pick a kind of book for {plural(missingKind)}.
            </p>
          )}
          {chosen.length > 0 && (
            <button
              type="button"
              className="button full"
              style={{ marginTop: 16 }}
              onClick={add}
              disabled={adding || missingKind > 0}
            >
              {adding ? "Adding…" : `Add ${plural(chosen.length)} to my shelf`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
