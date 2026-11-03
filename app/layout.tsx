import type { Metadata, Viewport } from "next";
import { Lato, Merriweather } from "next/font/google";
import "./globals.css";

const merriweather = Merriweather({
  variable: "--font-merriweather",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const lato = Lato({
  variable: "--font-lato",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shaalvim Library",
  description: "Shaalvim families lending each other their English books.",
};

export const viewport: Viewport = {
  themeColor: "#F6F3EC",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${merriweather.variable} ${lato.variable}`}>
      <body>{children}</body>
    </html>
  );
}
