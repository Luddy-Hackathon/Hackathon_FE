"use client";
import { BookOpen, GraduationCap, MessageSquare, User, Settings, LogOut } from "lucide-react";
import { BookOpen, GraduationCap, MessageSquare, User, Settings, LogOut, Map } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { motion } from "framer-motion";

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
    name: "Roadmap",
    icon: Map,
    href: "/roadmap",
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
      <div className="p-6 border-b border-zinc-200">
        <Link href="/" className="no-underline hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-black to-zinc-600 bg-clip-text text-transparent">🎓 Smart Selector</span>
          </div>
        </Link>
      </div>
      <div className="flex flex-col flex-1 py-4">
        {sidebarItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex items-center gap-3 px-6 py-3 text-zinc-600 no-underline hover:no-underline transition-all duration-200",
              "hover:text-black hover:bg-zinc-50",
              pathname === item.href && "text-black bg-zinc-50"
            )}
          >
            {pathname === item.href && (
              <motion.div
                layoutId="activeTab"
                className="absolute left-0 w-1 h-6 bg-black rounded-r-full"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <item.icon size={20} className="transition-transform group-hover:scale-110" />
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </div>
      <div className="p-6 border-t border-zinc-200">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-6 py-3 text-zinc-600 hover:text-black hover:bg-zinc-50 transition-all duration-200 w-full rounded-lg"
        >
          <LogOut size={20} />
          <span className="font-medium">Log Out</span>
        </button>
        <div className="text-xs text-zinc-500 mt-4 text-center">
          © 2025 Smart Course Selector
        </div>
      </div>
    </div>
  );
}