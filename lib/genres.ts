// The fixed list of genres, one per book. The database accepts the same keys
// (supabase/08-genres.sql).
export const genres = {
  fantasy: "Fantasy",
  science_fiction: "Science fiction",
  mystery_thriller: "Mystery & thriller",
  historical_fiction: "Historical fiction",
  classics: "Classics",
  adventure: "Adventure",
  romance: "Romance",
  humor: "Humor",
  general_fiction: "General fiction",
  biography_memoir: "Biography & memoir",
  history: "History",
  holocaust: "Holocaust",
  jewish_interest: "Jewish interest",
  business_money: "Business & money",
  self_help_psychology: "Self-help & psychology",
  science_ideas: "Science & ideas",
  hobbies_howto: "Hobbies & how-to",
} as const;

export type Genre = keyof typeof genres;

export function isGenre(value: unknown): value is Genre {
  return typeof value === "string" && value in genres;
}

// Checked in this order; the first match wins. Classics can't be told from
// subjects, so members pick it themselves.
const markers: [Genre, string[]][] = [
  ["holocaust", ["holocaust"]],
  ["biography_memoir", ["biography", "autobiography", "memoir"]],
  ["fantasy", ["fantasy", "magic", "wizard", "dragon", "fairy tale"]],
  ["science_fiction", ["science fiction", "dystopia", "time travel", "space travel"]],
  ["mystery_thriller", ["mystery", "detective", "thriller", "suspense", "spy", "crime"]],
  ["historical_fiction", ["historical fiction", "fiction, historical"]],
  ["romance", ["romance", "love stories"]],
  ["humor", ["humor", "humorous", "wit and humor", "comic strips", "comic books"]],
  ["adventure", ["adventure"]],
  ["jewish_interest", ["judaism", "jewish", "jews", "israel", "torah", "talmud"]],
  ["business_money", ["business", "economics", "finance", "investment", "management", "wall street"]],
  ["self_help_psychology", ["self-help", "psychology", "self-actualization", "success", "relationships"]],
  ["science_ideas", ["science", "philosophy", "technology", "mathematics", "artificial intelligence"]],
  ["history", ["history"]],
  ["hobbies_howto", ["games", "chess", "cooking", "crafts", "sports", "minecraft", "hobbies"]],
];

// A best guess from the catalog's subject list. Members can change it.
export function genreFrom(subjects: string[]): Genre | null {
  const all = subjects.map((s) => s.toLowerCase());
  for (const [genre, words] of markers) {
    if (all.some((s) => words.some((w) => s.includes(w)))) return genre;
  }
  if (all.some((s) => s.includes("fiction") || s.includes("novel"))) return "general_fiction";
  return null;
}
