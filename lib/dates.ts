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

export type ReminderSetting = "two_weeks" | "one_month" | "two_months" | "never";

// How the owner's reminder time reads in a sentence: "a month".
export const reminderWords: Record<Exclude<ReminderSetting, "never">, string> = {
  two_weeks: "two weeks",
  one_month: "a month",
  two_months: "two months",
};

// Whether a loan has passed the owner's reminder time.
export function isOverdue(reminderFrom: string, setting: ReminderSetting, now = new Date()): boolean {
  if (setting === "never") return false;
  const due = new Date(reminderFrom);
  if (setting === "two_weeks") due.setDate(due.getDate() + 14);
  else due.setMonth(due.getMonth() + (setting === "one_month" ? 1 : 2));
  return now >= due;
}
