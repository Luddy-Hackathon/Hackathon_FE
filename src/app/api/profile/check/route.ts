import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Remove the dynamic export directive
// export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get the user ID from the URL
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      console.log("Profile check called without a userId");
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    
    console.log(`Checking profile for user: ${userId}`);
    
    // Check if the user has a profile
    const { data, error } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") { // No rows returned
        console.log(`No profile found for user: ${userId}`);
        return NextResponse.json({ hasCompletedProfile: false });
      }
      
      console.error(`Error checking profile for user ${userId}:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // If data exists, the user has completed their profile
    console.log(`Profile found for user: ${userId}`);
    return NextResponse.json({ hasCompletedProfile: true });
  } catch (error) {
    console.error("Unexpected error in profile check:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 