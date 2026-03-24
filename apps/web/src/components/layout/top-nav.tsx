"use client";

import { useSession, signOut } from "@/lib/auth-client";
import Image from "next/image";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { useState } from "react";

export function TopNav() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6">
      {/* Logo — visible only on mobile (sidebar is hidden) */}
      <Link href="/trips" className="flex items-center gap-2 md:hidden">
        <Image
          src="/My-Trip-Planner-icon.png"
          alt="My Trip Planner"
          width={30}
          height={30}
          className="rounded-md"
        />
        <span className="font-bold text-gray-900 text-sm">My Trip Planner</span>
      </Link>

      {/* Spacer on desktop so user menu stays right-aligned */}
      <div className="hidden md:block" />

      {session?.user && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 md:gap-2.5 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
          >
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "User"}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
            )}
            {/* Name hidden on mobile to save space */}
            <span className="hidden md:block text-sm font-medium text-gray-700">
              {session.user.name}
            </span>
          </button>

          {menuOpen && (
            <>
              {/* Close overlay */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-medium text-gray-800 truncate">{session.user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
