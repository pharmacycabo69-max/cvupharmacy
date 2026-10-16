import type { Metadata } from "next";
import Link from "next/link";
import { topCategories } from "@/lib/data";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: { default: "CVU Pharmacy Cabo San Lucas — 24/7 Hotel Pharmacy Delivery", template: "%s | CVU Pharmacy" },
  description: "English-speaking pharmacy delivery in Cabo San Lucas. OTC medications, vitamins, and wellness essentials delivered 24/7 to your hotel, villa or yacht.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cats = topCategories().slice(0, 12);
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen flex flex-col">
        <div className="bg-brand text-center text-xs text-white py-2 px-4">
          Free delivery on orders $99+ · Most deliveries in 45–60 minutes · English-speaking staff
        </div>
        <header className="border-b border-soft">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
            <Link href="/" className="text-xl font-bold text-brand">CVU Pharmacy</Link>
            <form action="/search" className="order-3 w-full md:order-none md:w-auto md:flex-1 md:max-w-md">
              <input name="q" type="search" placeholder="Search products…" className="w-full rounded-full border border-soft bg-soft px-4 py-2 text-sm outline-none focus:border-brand" />
            </form>
            <nav className="ml-auto flex items-center gap-5 text-sm">
              <Link href="/shop">Shop</Link>
              <Link href="/blog">Blog</Link>
              <a href="tel:+526242261023" className="rounded-full bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">+52 624 226 1023</a>
            </nav>
          </div>
          <nav className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 pb-3 text-sm text-muted">
            {cats.map((c) => <Link key={c.id} href={`/category/${c.slug}`} className="whitespace-nowrap hover:text-brand">{c.name}</Link>)}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-soft py-8 text-center text-sm text-muted">
          <div className="mb-2 flex justify-center gap-5">
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms-of-service">Terms</Link>
            <Link href="/refund-policy">Refunds</Link>
            <Link href="/cookie-policy">Cookies</Link>
          </div>
          © {new Date().getFullYear()} CVU Pharmacy Cabo San Lucas
        </footer>
      </body>
    </html>
  );
}
