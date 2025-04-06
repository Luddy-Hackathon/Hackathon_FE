"use client";

import { BookOpen, GraduationCap, MessageSquare, User, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

const sidebarItems = [
  {
    name: "Course Recommendations",
    icon: BookOpen,
    href: "/",
  },
  {
    name: "Course Catalog",
    icon: GraduationCap,
    href: "/courses",
  },
  {
    name: "Chat Assistant",
    icon: MessageSquare,
    href: "/chat",
  },
  {
    name: "Profile",
    icon: User,
    href: "/profile",
  },
  {
    name: "Settings",
    icon: Settings,
    href: "/settings",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <div className="w-64 border-r border-zinc-200 bg-white h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-4 border-b border-zinc-200">
        <Link href="/">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">🎓 Smart Selector</span>
          </div>
        </Link>
      </div>
      <div className="flex flex-col flex-1 py-4">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-zinc-600 hover:bg-zinc-100 transition-colors",
              pathname === item.href && "bg-zinc-100 text-zinc-900"
            )}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
      <div className="p-4 border-t border-zinc-200">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 text-zinc-600 hover:bg-zinc-100 transition-colors w-full"
        >
          <LogOut size={20} />
          <span>Log Out</span>
        </button>
        <div className="text-xs text-zinc-500 mt-2">
          © 2025 Smart Course Selector
        </div>
      </div>
    </div>
  );
}
