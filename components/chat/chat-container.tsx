"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Send, User, GitGraph as Typography, Loader2 } from "lucide-react";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatSuggestions } from "@/components/chat/chat-suggestions";

type MessageType = "user" | "assistant";

interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hello! I'm your font assistant. How can I help you today? You can ask me about your fonts, get recommendations, or ask for help finding specific styles.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sample responses for demo purposes
  const sampleResponses = [
    "I found 5 serif fonts in your collection. Would you like to see them?",
    "For modern, geometric sans-serif fonts, I'd recommend Inter, Montserrat, or SF Pro from your collection.",
    "Looking at your preferences, you seem to favor clean, humanist sans-serif typefaces. Would you like recommendations for similar fonts?",
    "The font 'Playfair Display' in your collection is a transitional serif designed by Claus Eggers Sørensen. It has 4 weights and supports both Latin and Cyrillic scripts.",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const randomResponse = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: randomResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <Card className="h-[calc(100vh-16rem)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Typography className="h-5 w-5" />
          Font Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pr-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {isTyping && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 bg-primary">
                <Typography className="h-4 w-4 text-primary-foreground" />
              </Avatar>
              <div className="flex items-center bg-muted text-muted-foreground rounded-md px-4 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Thinking...
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      
      {messages.length === 1 && (
        <div className="px-4 pb-4">
          <ChatSuggestions onSelectSuggestion={(suggestion) => setInput(suggestion)} />
        </div>
      )}
      
      <CardFooter className="border-t pt-4">
        <form 
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <Input
            placeholder="Ask about your fonts..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={input.trim() === "" || isTyping}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}