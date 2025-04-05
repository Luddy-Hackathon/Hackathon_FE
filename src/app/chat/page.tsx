import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Chat Assistant | Smart Course Selector",
  description: "Chat with our AI assistant to get personalized course recommendations",
};

export default function ChatPage() {
  return (
    <div className="container mx-auto p-6 pt-4 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Chat Assistant</h1>

      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Chat Assistant</CardTitle>
          <CardDescription>
            The chat assistant is available in the right sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-zinc-700">
            Feel free to ask questions about courses, recommendations, or career paths.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
