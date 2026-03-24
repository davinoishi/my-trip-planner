"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { List, Map, FileText, Users, Settings, CloudSun, ShoppingBag, NotebookPen } from "lucide-react";

const tabs = [
  { label: "Itinerary",      href: "",             icon: List },
  { label: "Map",            href: "/map",          icon: Map },
  { label: "Notes",          href: "/notes",        icon: NotebookPen },
  { label: "What to Expect", href: "/weather",      icon: CloudSun },
  { label: "Packing List",   href: "/packing",      icon: ShoppingBag },
  { label: "Documents",      href: "/documents",    icon: FileText },
  { label: "People",         href: "/participants", icon: Users },
  { label: "Settings",       href: "/settings",     icon: Settings },
];

export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;

  return (
    <nav className="flex border-b border-gray-100 -mb-px overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const isActive = tab.href === ""
          ? pathname === base
          : pathname.startsWith(href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 md:px-4 md:py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
              isActive
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {/* Label always shown — tabs scroll horizontally on mobile */}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
