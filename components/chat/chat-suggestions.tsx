import { Button } from "@/components/ui/button";

interface ChatSuggestionsProps {
  onSelectSuggestion: (suggestion: string) => void;
}

export function ChatSuggestions({ onSelectSuggestion }: ChatSuggestionsProps) {
  const suggestions = [
    "Show me all my sans-serif fonts",
    "What fonts would work well for a minimalist website?",
    "Find heavy grotesque fonts in my collection",
    "Which variable fonts do I have?",
    "Recommend a font pair for a wedding invitation",
    "What's the difference between Inter and Roboto?",
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Try asking</h3>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onSelectSuggestion(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}