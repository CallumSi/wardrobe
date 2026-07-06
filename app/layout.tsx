import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "800", "900"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Wardrobe",
  description: "Personal wardrobe inventory and style manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${plexMono.variable}`}>
        <div className="selvedge" aria-hidden="true" />
        <header className="site-header">
          <Link href="/" className="wordmark">
            Wardrobe<span className="wordmark-tag">/ Callum</span>
          </Link>
          <nav className="site-nav">
            <Link href="/">Inventory</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/shopping">Shopping</Link>
            <Link href="/settings">Settings</Link>
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
