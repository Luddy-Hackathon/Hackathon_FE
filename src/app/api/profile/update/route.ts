import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Remove the dynamic export directive
// export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const data = await request.json();
    
    if (!data.user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Extract ID to use for the update
    const { id } = data;
    
    if (!id) {
      return NextResponse.json({ error: "Profile ID is required for update" }, { status: 400 });
    }
    
    console.log(`Updating profile ${id} for user ${data.user_id}`);
    
    // Make sure the profile belongs to the user
    const { data: existingProfile, error: fetchError } = await supabase
      .from("students")  // Changed from "profiles" to "students" to match the table used in POST
      .select("user_id")
      .eq("id", id)
      .single();
      
    if (fetchError) {
      console.error(`Error fetching existing profile ${id}:`, fetchError);
      if (fetchError.code === "PGRST116") {  // No rows returned
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    
    if (!existingProfile) {
      console.error(`Profile ${id} not found`);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    
    if (existingProfile.user_id !== data.user_id) {
      console.error(`Unauthorized update attempt: profile ${id} belongs to ${existingProfile.user_id}, not ${data.user_id}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Remove ID from the data object as it's not needed in the update
    const { id: _, ...updateData } = data;

    // Update the profile
    const { error } = await supabase
      .from("students")  // Changed from "profiles" to "students"
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error(`Error updating profile ${id}:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Successfully updated profile ${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 