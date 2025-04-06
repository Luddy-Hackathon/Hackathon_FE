"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ClientChatAssistant from "@/components/chat/ClientChatAssistant";
import { supabase } from "@/lib/supabase";
import { Course, Student } from "@/types";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);

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

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (studentError) throw studentError;

        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*');

        if (coursesError) throw coursesError;

        setStudent(studentData);
        setCourses(coursesData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    fetchData();
  }, [user]);

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
        <main className="flex-1 overflow-y-auto pr-4">{children}</main>
        <div className="w-[420px] hidden md:block border-l border-gray-200">
          {student && courses.length > 0 && (
            <ClientChatAssistant student={student} courses={courses} />
          )}
        </div>
      </div>
    </div>
  );
} 