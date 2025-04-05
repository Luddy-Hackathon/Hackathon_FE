"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ClientChatAssistant from "@/components/chat/ClientChatAssistant";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user && !["/signin", "/signup"].includes(pathname)) {
      router.push("/signin");
    }
  }, [user, pathname, router]);

  if (!user && !["/signin", "/signup"].includes(pathname)) {
    return null;
  }

  if (["/signin", "/signup"].includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <div className="flex flex-1 ml-64">
        <main className="flex-1 overflow-y-auto">{children}</main>
        <div className="w-80 hidden md:block">
          <ClientChatAssistant />
        </div>
      </div>
    </div>
  );
} 