import Link from "next/link";
import { Cover } from "../cover";

export type GridItem = {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  lines: string[];
  status: { text: string; tone: "available" | "warning" | "muted" };
};

export function BookGrid({ items }: { items: GridItem[] }) {
  return (
    <ul className="book-grid">
      {items.map((item) => (
        <li key={item.bookId}>
          <Link href={`/books/${item.bookId}`} className="grid-book">
            <Cover title={item.title} author={item.author} coverUrl={item.coverUrl} />
            <span className="book-name">{item.title}</span>
            {item.lines.map((line) => (
              <span key={line} className="grid-line">
                {line}
              </span>
            ))}
            <span className={`status status-${item.status.tone}`}>{item.status.text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
