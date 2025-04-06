import { supabase } from "@/lib/supabase";

/**
 * Creates or updates a user profile in the database
 */
export async function createProfile(profileData: any) {
  try {
    const { data, error } = await supabase
      .from("students")
      .upsert(profileData, {
        onConflict: "user_id",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("API Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Unexpected API error:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}
