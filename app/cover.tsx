"use client";

import Image from "next/image";
import { useState } from "react";

// A book cover from the catalog, or a plain colored block with the title and
// author when the catalog has no picture or the picture doesn't load.
const blockColors = [
  "#3f5e4b",
  "#7a4e2d",
  "#2f4858",
  "#4a4a6a",
  "#5b3a50",
  "#3d5a73",
  "#5e6b3e",
  "#8a5335",
  "#2b2118",
];

// How wide each kind of cover shows, so the right-sized copy is fetched.
const sizes = { grid: "(min-width: 900px) 180px, 45vw", large: "220px", thumb: "46px" };

function colorFor(title: string) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return blockColors[hash % blockColors.length];
}

export function Cover({
  title,
  author,
  coverUrl,
  size = "grid",
}: {
  title: string;
  author: string;
  coverUrl: string | null;
  size?: "grid" | "large" | "thumb";
}) {
  const [failed, setFailed] = useState(false);
  const className = `cover cover-${size}`;

  if (coverUrl && !failed) {
    return (
      <Image
        className={className}
        src={coverUrl}
        alt={`Cover of ${title}`}
        width={200}
        height={300}
        sizes={sizes[size]}
        onError={() => setFailed(true)}
        // The catalog sends a tiny blank picture when it has no real cover.
        onLoad={(e) => e.currentTarget.naturalWidth < 10 && setFailed(true)}
      />
    );
  }
  return (
    <div className={`${className} cover-block`} style={{ background: colorFor(title) }} aria-hidden>
      {size !== "thumb" && (
        <>
          <span className="cover-title">{title}</span>
          <span className="cover-author">{author}</span>
        </>
      )}
    </div>
  );
}
