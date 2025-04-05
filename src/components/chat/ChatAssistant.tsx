"use client";

import { SendIcon, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
}

export default function ChatAssistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm your Smart Course Selector AI. I can help you find courses that match your career goals, skills, and schedule. What would you like to know?",
      isUser: false,
    },
  ]);

  const handleSendMessage = () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      isUser: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'll help you find the perfect course for your needs. Based on your profile, I would recommend exploring courses in data science or machine learning to align with your career goals.",
        isUser: false,
      };

      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full border-l border-zinc-200 w-full">
      <div className="border-b border-zinc-200 p-4">
        <h2 className="font-semibold text-lg">Chat Assistant</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${
              message.isUser
                ? "ml-auto bg-zinc-100"
                : "mr-auto bg-zinc-100"
            } p-3 rounded-lg max-w-[80%]`}
          >
            {message.content}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-200">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
          >
            <PlusCircle size={20} />
          </Button>
          <div className="flex-1 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              size="icon"
              className="rounded-full"
            >
              <SendIcon size={16} />
            </Button>
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-500 text-center">
          Powered by Smart Course Selector AI
        </div>
      </div>
    </div>
  );
}
