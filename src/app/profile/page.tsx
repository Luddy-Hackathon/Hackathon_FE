import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Profile | Smart Course Selector",
  description: "Manage your profile and learning preferences",
};

export default function ProfilePage() {
  return (
    <div className="container mx-auto p-6 pt-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Profile</h1>
        <Button variant="outline">Edit Profile</Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Your basic information used for personalized course recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-medium text-zinc-500 mb-1">Full Name</h3>
              <p>Alex Johnson</p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-500 mb-1">Email</h3>
              <p>alex.johnson@example.com</p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-500 mb-1">Career Goals</h3>
              <p>Data Scientist, Machine Learning Engineer</p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-500 mb-1">Current Skills</h3>
              <p>Python, SQL, Statistics, Excel</p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-500 mb-1">Weekly Availability</h3>
              <p>10-15 hours</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Learning Preferences</CardTitle>
            <CardDescription>
              Your preferences help us recommend the most suitable courses
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-medium text-zinc-500 mb-1">Learning Style</h3>
              <p>Visual, Hands-on projects</p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-500 mb-1">Preferred Course Format</h3>
              <p>Online, self-paced with some deadlines</p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-500 mb-1">Certification Preference</h3>
              <p>Industry-recognized certifications</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
