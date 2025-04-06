import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/auth/AuthProvider";
import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";
import { RecommendationsProvider } from "@/context/RecommendationsContext";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "EduMuse",
  description: "Your AI-powered learning companion for personalized education",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={cn("antialiased min-h-screen bg-background", inter.variable)}>
        <AuthProvider>
          <RecommendationsProvider>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
            <Toaster />
          </RecommendationsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

