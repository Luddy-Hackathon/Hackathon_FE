"use client";

import { Metadata } from "next";
import Dashboard from "@/components/Dashboard";
import { RecommendationsProvider } from "@/context/RecommendationsContext";

export default function HomePage() {
  return (
    <main>
      <RecommendationsProvider>
        <Dashboard />
      </RecommendationsProvider>
    </main>
  );
}
