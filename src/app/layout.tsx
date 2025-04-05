import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import ClientChatAssistant from "@/components/chat/ClientChatAssistant";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Smart Course Selector",
  description: "AI-powered course recommendation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn("antialiased", inter.variable)}>
        <div className="flex h-screen bg-white">
          <Sidebar />
          <div className="flex flex-1 ml-64">
            <main className="flex-1 overflow-y-auto">{children}</main>
            <div className="w-80 hidden md:block">
              <ClientChatAssistant />
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
