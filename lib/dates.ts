// Dates in words, in Israel's time zone.
const zone = "Asia/Jerusalem";

function dayNumber(date: Date): number {
  const [y, m, d] = date
    .toLocaleDateString("en-CA", { timeZone: zone })
    .split("-")
    .map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

// "12 September", with the year when it isn't this year.
export function dayAndMonth(iso: string): string {
  const date = new Date(iso);
  const sameYear =
    date.toLocaleDateString("en-GB", { timeZone: zone, year: "numeric" }) ===
    new Date().toLocaleDateString("en-GB", { timeZone: zone, year: "numeric" });
  return date.toLocaleDateString("en-GB", {
    timeZone: zone,
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// "today", "yesterday", "3 days ago", or "on 12 September".
export function whenAgo(iso: string): string {
  const days = dayNumber(new Date()) - dayNumber(new Date(iso));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return `on ${dayAndMonth(iso)}`;
}
