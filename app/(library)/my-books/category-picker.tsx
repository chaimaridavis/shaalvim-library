"use client";

import type { Category } from "@/lib/catalog";

export const categoryNames: Record<Category, string> = {
  childrens: "Children's",
  fiction: "Fiction",
  nonfiction: "Non-fiction",
};

export function CategoryPicker({
  value,
  onChange,
  label,
}: {
  value: Category | null;
  onChange: (value: Category) => void;
  label: string;
}) {
  return (
    <select
      className="select select-small"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value as Category)}
      aria-label={label}
    >
      {!value && <option value="">Pick a kind…</option>}
      {(Object.keys(categoryNames) as Category[]).map((c) => (
        <option key={c} value={c}>
          {categoryNames[c]}
        </option>
      ))}
    </select>
  );
}
