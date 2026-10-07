"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/property-images", label: "Property Images" },
  { href: "/postcards", label: "Postcards" },
  { href: "/import", label: "Import" },
  { href: "/export", label: "QR Export" },
];

export default function Nav({ variant }: { variant: "sidebar" | "mobile" }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  if (variant === "mobile") {
    return (
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              isActive(item.href) ? "bg-gold text-white" : "text-forest-100 hover:bg-forest-800"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`relative rounded-lg px-3 py-2 text-sm transition ${
            isActive(item.href)
              ? "bg-forest-800 font-medium text-white"
              : "text-forest-100 hover:bg-forest-800/60 hover:text-white"
          }`}
        >
          {isActive(item.href) && (
            <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-gold" />
          )}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
