import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Settings | Smart Course Selector",
  description: "Manage your account settings and preferences",
};

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 pt-4 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button>Save Changes</Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
            <CardDescription>
              Manage your account settings and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="public-profile" className="font-medium">
                  Public Profile
                </Label>
                <p className="text-zinc-500 text-sm">
                  Allow others to view your learning journey and achievements
                </p>
              </div>
              <Switch id="public-profile" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-notifications" className="font-medium">
                  Email Notifications
                </Label>
                <p className="text-zinc-500 text-sm">
                  Receive updates about new courses and learning opportunities
                </p>
              </div>
              <Switch id="email-notifications" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="course-updates" className="font-medium">
                  Course Updates
                </Label>
                <p className="text-zinc-500 text-sm">
                  Get notified about updates to courses you're enrolled in
                </p>
              </div>
              <Switch id="course-updates" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Assistant Settings</CardTitle>
            <CardDescription>
              Configure how the AI assistant works for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="ai-suggestions" className="font-medium">
                  AI Course Suggestions
                </Label>
                <p className="text-zinc-500 text-sm">
                  Allow the AI to suggest courses based on your profile
                </p>
              </div>
              <Switch id="ai-suggestions" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="learning-history" className="font-medium">
                  Use Learning History
                </Label>
                <p className="text-zinc-500 text-sm">
                  Let the AI analyze your past courses to improve recommendations
                </p>
              </div>
              <Switch id="learning-history" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="career-analysis" className="font-medium">
                  Career Path Analysis
                </Label>
                <p className="text-zinc-500 text-sm">
                  Get insights about how courses align with your career goals
                </p>
              </div>
              <Switch id="career-analysis" defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
