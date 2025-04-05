"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ClientChatAssistant from "@/components/chat/ClientChatAssistant";
import { supabase } from "@/lib/supabase";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);


  useEffect(() => {
    if (!user && !["/signin", "/signup"].includes(pathname)) {
      router.push("/signin");
    }
  }, [user, pathname, router]);

  useEffect(() => {
    const checkProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from("students")
          .select("id")
          .eq("user_id", user.id)
          .single();
        setHasProfile(!!data);
        
        if (!data && !["/profile-setup"].includes(pathname)) {
          router.push("/profile-setup");
        }
      }
    };
    
    checkProfile();
  }, [user, pathname, router]);

  if (!user && !["/signin", "/signup"].includes(pathname)) {
    return null;
  }

  if (["/signin", "/signup", "/profile-setup"].includes(pathname)) {
    return <>{children}</>;
  }

  if (hasProfile === false) {
    return null;
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