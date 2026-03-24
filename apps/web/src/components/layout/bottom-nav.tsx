"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Import, Search, BarChart2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/trips",    label: "Trips",    icon: Plane },
  { href: "/search",   label: "Search",   icon: Search },
  { href: "/import",   label: "Import",   icon: Import },
  { href: "/stats",    label: "Stats",    icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 md:hidden">
      <div className="flex items-stretch h-16" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-blue-600" : "text-gray-400 active:text-gray-600"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
