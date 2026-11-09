"use client";

import { genres, type Genre } from "@/lib/genres";

export function GenrePicker({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: Genre | null;
  onChange: (value: Genre | null) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      className="select select-small"
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as Genre | null)}
      aria-label={label}
      disabled={disabled}
    >
      <option value="">No genre yet</option>
      {(Object.keys(genres) as Genre[]).map((g) => (
        <option key={g} value={g}>
          {genres[g]}
        </option>
      ))}
    </select>
  );
}
