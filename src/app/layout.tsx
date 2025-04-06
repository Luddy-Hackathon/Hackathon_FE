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
        <AuthProvider>
          <RecommendationsProvider>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
          </RecommendationsProvider>
          <AuthenticatedLayout>{children}</AuthenticatedLayout>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

