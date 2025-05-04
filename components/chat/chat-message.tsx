import { Avatar } from "@/components/ui/avatar";
import { GitGraph as Typography, User } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.type === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <Avatar className="h-8 w-8 bg-primary">
          <Typography className="h-4 w-4 text-primary-foreground" />
        </Avatar>
      )}
      
      <div className="space-y-1 max-w-[80%]">
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground ml-auto"
              : "bg-muted"
          }`}
        >
          {message.content}
        </div>
        <div
          className={`text-xs text-muted-foreground ${
            isUser ? "text-right" : ""
          }`}
        >
          {format(message.timestamp, "h:mm a")}
        </div>
      </div>
      
      {isUser && (
        <Avatar className="h-8 w-8 bg-secondary">
          <User className="h-4 w-4" />
        </Avatar>
      )}
    </div>
  );
}