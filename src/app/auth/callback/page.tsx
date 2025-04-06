"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  useEffect(() => {
    const handleCallback = async () => {
      if (code) {
        try {
          // Exchange the code for a session on the client-side
          await supabase.auth.exchangeCodeForSession(code);
          
          // Check if user has a profile
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            try {
              const response = await fetch(`/api/profile/check?userId=${session.user.id}`);
              if (response.ok) {
                const { hasCompletedProfile } = await response.json();
                
                if (!hasCompletedProfile) {
                  router.push('/profile/setup');
                  return;
                }
              }
            } catch (error) {
              console.error('Error checking profile:', error);
            }
          }
          
          router.push('/');
        } catch (error) {
          console.error("Error handling auth callback:", error);
          router.push('/signin');
        }
      } else {
        router.push('/signin');
      }
    };

    handleCallback();
  }, [code, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">Finalizing your authentication...</h2>
        <p className="text-gray-500">Please wait while we set up your account.</p>
      </div>
    </div>
  );
} 