import { ChatContainer } from "@/components/chat/chat-container";

export default function ChatPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Chat with Your Collection</h1>
        <p className="text-muted-foreground">
          Ask questions about your fonts and get AI-powered recommendations.
        </p>
      </div>
      
      <ChatContainer />
    </div>
  );
}