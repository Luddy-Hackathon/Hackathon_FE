"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { clearUserDataFromStorage } from "@/lib/utils";

interface AuthContextType {
  user: User | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata?: { name: string }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check active sessions and sets the user
    const initializeAuth = async () => {
      try {
        console.log("Initializing auth...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          setUser(null);
        } else {
          const currentUser = session?.user ?? null;
          setUser(currentUser);

          if (currentUser) {
            const { data: student, error: studentError } = await supabase
                .from("students")
                .select("*")
                .eq("user_id", currentUser.id)
                .single();

            if (!student || studentError) {
              console.log("Redirecting to profile setup...");
              router.push("/profile-setup");
            }
          }
        }
      } catch (error) {
        console.error("Unexpected error getting session:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for changes on auth state (signed in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email);
      
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        router.push('/');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        router.push('/signin');
      } else if (event === 'INITIAL_SESSION') {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      console.log("Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, [router]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log("Attempting sign in...");
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error("Sign in error:", error);
      }
      return { error };
    } catch (error) {
      console.error("Unexpected sign in error:", error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, metadata?: { name: string }) => {
    try {
      console.log("Attempting sign up...");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("Sign up error:", error);
        return { error };
      }

      if (data?.user) {
        console.log("User created:", data.user.email);
        // Update user metadata if provided
        if (metadata?.name) {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { name: metadata.name }
          });
          if (updateError) {
            console.error("Error updating user metadata:", updateError);
          }
        }
      }

      return { error: null };
    } catch (error) {
      console.error("Unexpected error during sign up:", error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log("Attempting sign out...");
      
      // Clear user data from localStorage
      if (user?.id) {
        clearUserDataFromStorage(user.id);
      }
      
      await supabase.auth.signOut();
      router.push("/signin");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
} 