import "server-only";

export type Category = "childrens" | "fiction" | "nonfiction" | "comics";

// A book as found in a public catalog, before it is saved to the library.
export type CatalogBook = {
  source: "openlibrary" | "google";
  sourceId: string;
  title: string;
  author: string;
  firstPublished: number | null;
  category: Category | null;
  coverUrl: string | null;
};

const userAgent = "ShaalvimLibrary/1.0 (https://shaalvim-library.vercel.app)";

const smallWords = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);

// Some catalog titles arrive all in lower case ("The blue castle").
function tidyTitle(title: string): string {
  if (/[A-Z]/.test(title.slice(1))) return title;
  return title
    .split(" ")
    .map((word, i) =>
      i > 0 && smallWords.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function matchKey(title: string, author = ""): string {
  const clean = (s: string) =>
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  return `${clean(title)}|${clean(author)}`;
}

const comicsMarkers = [
  "comic books, strips",
  "comic strips",
  "comics & graphic novels",
  "graphic novels",
  "cartoons and caricatures",
  "american wit and humor, pictorial",
];
const childrensMarkers = [
  "picture book",
  "children's fiction",
  "children's stories",
  "children's literature",
  "juvenile fiction",
  "juvenile literature",
  "board book",
];
const fictionMarkers = ["fiction", "novel", "fantasy", "romance", "mystery", "thriller"];
const nonfictionMarkers = [
  "nonfiction",
  "non-fiction",
  "biography",
  "memoir",
  "history",
  "science",
  "self-help",
  "religion",
  "judaism",
  "philosophy",
  "psychology",
  "economics",
  "politics",
  "cooking",
  "travel",
  "business",
  "essays",
  "parenting",
];

// A best guess from the catalog's subject list. Members can change it.
export function categoryFrom(subjects: string[]): Category | null {
  const all = subjects.map((s) => s.toLowerCase());
  const matches = (list: string[], markers: string[]) =>
    list.some((s) => markers.some((m) => s.includes(m)));
  const has = (markers: string[]) => matches(all, markers);

  // Comics only when nothing else describes it as a novel or children's book:
  // the catalog lists comic-book editions of novels too, such as The Hobbit.
  const comicSubjects = all.filter((s) => comicsMarkers.some((m) => s.includes(m)));
  const otherSubjects = all.filter((s) => !comicSubjects.includes(s));
  if (
    comicSubjects.length &&
    !matches(otherSubjects, fictionMarkers) &&
    !matches(otherSubjects, childrensMarkers)
  ) {
    return "comics";
  }
  if (has(childrensMarkers)) return "childrens";
  if (has(fictionMarkers) && !all.some((s) => s.includes("non-fiction") || s.includes("nonfiction"))) {
    return "fiction";
  }
  if (has(nonfictionMarkers)) return "nonfiction";
  return null;
}

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
};

async function searchOpenLibrary(params: Record<string, string>, limit: number) {
  const query = new URLSearchParams({
    ...params,
    fields: "key,title,author_name,first_publish_year,cover_i,subject",
    limit: String(limit),
    lang: "en",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${query}`, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data: { docs: OpenLibraryDoc[] } = await res.json();
  return data.docs.map(
    (doc): CatalogBook => ({
      source: "openlibrary",
      sourceId: doc.key,
      title: tidyTitle(doc.title),
      author: doc.author_name?.[0] ?? "",
      firstPublished: doc.first_publish_year ?? null,
      category: categoryFrom(doc.subject ?? []),
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    }),
  );
}

type GoogleVolume = {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publishedDate?: string;
    categories?: string[];
    imageLinks?: { thumbnail?: string };
  };
};

// Fallback when Open Library has nothing. Google allows only a few requests
// without a key, so set GOOGLE_BOOKS_API_KEY in Vercel to rely on it.
async function searchGoogle(q: string, limit: number) {
  const query = new URLSearchParams({ q, maxResults: String(limit), printType: "books" });
  if (process.env.GOOGLE_BOOKS_API_KEY) query.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${query}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data: { items?: GoogleVolume[] } = await res.json();
  return (data.items ?? []).map(({ id, volumeInfo: v }): CatalogBook => {
    const year = Number(v.publishedDate?.slice(0, 4));
    return {
      source: "google",
      sourceId: id,
      title: tidyTitle(v.title),
      author: v.authors?.[0] ?? "",
      firstPublished: Number.isInteger(year) && year > 0 ? year : null,
      category: categoryFrom(v.categories ?? []),
      coverUrl: v.imageLinks?.thumbnail?.replace(/^http:/, "https:") ?? null,
    };
  });
}

// For the "Add one book" search box.
export async function searchCatalog(text: string): Promise<CatalogBook[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const found = await searchOpenLibrary({ q }, 8).catch(() => []);
  return found.length ? found : searchGoogle(q, 8);
}

// Splits a pasted line such as "Matilda, Roald Dahl", "Wonder by R.J. Palacio"
// or "The Book Thief - Markus Zusak" into title and author.
export function splitLine(line: string): { title: string; author: string } {
  const text = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
  const by = text.match(/^(.+?)\s+by\s+(.+)$/i);
  if (by) return { title: by[1].trim(), author: by[2].trim() };
  // The last separator, so titles with commas ("The Lion, the Witch and the
  // Wardrobe, C.S. Lewis") keep them.
  const sep = text.match(/^(.+)\s*(?:,|\s[-–—]\s|\|)\s*(.+)$/);
  if (sep) return { title: sep[1].trim(), author: sep[2].trim() };
  return { title: text, author: "" };
}

const normal = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const withoutArticle = (s: string) => s.replace(/^(the|a|an) /, "");

// "confident" when the title matches (ignoring a leading "The", and a
// subtitle or series name on either side) and, if an author was given, their
// surname appears.
function isConfident(book: CatalogBook, title: string, author: string) {
  const clean = (s: string) => withoutArticle(normal(s));
  const wantRest = title.split(":").slice(1);
  const want = clean(title);
  const wantSub = wantRest.length ? clean(wantRest.join(":")) : "";
  const got = clean(book.title);
  const gotMain = clean(book.title.split(/[:(]/)[0]);
  const titleMatches =
    want === got ||
    (!wantSub && want === gotMain) ||
    (wantSub !== "" && (wantSub === got || wantSub === gotMain));
  if (!titleMatches) return false;
  if (!author) return true;
  const surname = normal(author).split(" ").pop() ?? "";
  return normal(book.author).includes(surname);
}

export type LineMatch = {
  line: string;
  // The title part of the line, to start a "Change" search with.
  title: string;
  book: CatalogBook | null;
  confident: boolean;
};

export async function matchLine(line: string): Promise<LineMatch> {
  const { title, author } = splitLine(line);
  const params: Record<string, string> = author ? { title, author } : { title };
  let candidates = await searchOpenLibrary(params, 5).catch(() => []);
  if (!candidates.length) {
    // A looser search on all the words, for series titles and odd spellings.
    candidates = await searchOpenLibrary({ q: `${title.replace(/[:()]/g, " ")} ${author}` }, 5).catch(
      () => [],
    );
  }
  if (!candidates.length) {
    candidates = await searchGoogle(author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`, 5);
  }
  if (!candidates.length) return { line, title, book: null, confident: false };

  const confident = candidates.find((b) => isConfident(b, title, author));
  // Prefer a confident match that has a cover.
  const best =
    candidates.find((b) => isConfident(b, title, author) && b.coverUrl) ?? confident ?? candidates[0];
  return { line, title, book: best, confident: Boolean(confident) };
}
