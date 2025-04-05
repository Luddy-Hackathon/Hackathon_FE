"use client";

import dynamic from "next/dynamic";

// Dynamically import the ChatAssistant with no SSR
const DynamicChatAssistant = dynamic(
  () => import("@/components/chat/ChatAssistant"),
  { ssr: false }
);

export default function ClientChatAssistant() {
  return <DynamicChatAssistant />;
}
