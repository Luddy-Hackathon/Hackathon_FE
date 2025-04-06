import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export function useProfileCheck() {
  const { user } = useAuth();
  const [hasCompletedProfile, setHasCompletedProfile] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function checkProfile() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/profile/check?userId=${user.id}`);
        
        if (!response.ok) {
          throw new Error("Failed to check profile status");
        }
        
        const data = await response.json();
        setHasCompletedProfile(data.hasCompletedProfile);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    }

    checkProfile();
  }, [user]);

  return { hasCompletedProfile, isLoading, error };
} 