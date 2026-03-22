"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Map, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/trips", label: "My Trips", icon: Plane },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/trips" className="flex items-center gap-2.5">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Plane className="w-5 h-5" />
          </div>
          <span className="font-bold text-gray-900 text-base leading-tight">
            My Trip<br />Planner
          </span>
        </Link>
      </div>

      {/* New Trip Button */}
      <div className="px-4 py-4">
        <Link
          href="/trips/new"
          className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors w-full"
        >
          <Plus className="w-4 h-4" />
          New Trip
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 py-4 border-t border-gray-100">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
