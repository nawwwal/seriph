"use client";

import { useState } from "react";
import { FontCard } from "@/components/library/font-card";
import { Button } from "@/components/ui/button";
import { CheckSquare, Square } from "lucide-react";
import { useFontSelection } from "@/hooks/use-font-selection";

// Mock data for demonstration
const mockFonts = [
  {
    id: "1",
    name: "Inter",
    family: "Sans-serif",
    foundry: "Rasmus Andersson",
    variable: true,
    weights: ["Variable"],
    styles: ["Regular", "Italic"],
    tags: ["Sans-serif", "Geometric", "Humanist"],
    license: "Open Source",
    uploaded: "2023-05-12T14:32:00Z",
    previewText: "The quick brown fox jumps over the lazy dog",
    previewImage: null,
  },
  {
    id: "2",
    name: "Roboto",
    family: "Sans-serif",
    foundry: "Google",
    variable: false,
    weights: ["Thin", "Light", "Regular", "Medium", "Bold", "Black"],
    styles: ["Regular", "Italic"],
    tags: ["Sans-serif", "Grotesque"],
    license: "Open Source",
    uploaded: "2023-05-10T09:15:00Z",
    previewText: "The quick brown fox jumps over the lazy dog",
    previewImage: null,
  },
  {
    id: "3",
    name: "Playfair Display",
    family: "Serif",
    foundry: "Claus Eggers Sørensen",
    variable: false,
    weights: ["Regular", "Medium", "Bold", "Black"],
    styles: ["Regular", "Italic"],
    tags: ["Serif", "Display"],
    license: "Open Source",
    uploaded: "2023-06-01T16:45:00Z",
    previewText: "The quick brown fox jumps over the lazy dog",
    previewImage: null,
  },
  {
    id: "4",
    name: "JetBrains Mono",
    family: "Monospace",
    foundry: "JetBrains",
    variable: false,
    weights: ["Thin", "Light", "Regular", "Medium", "Bold", "ExtraBold"],
    styles: ["Regular", "Italic"],
    tags: ["Monospace", "Coding"],
    license: "Open Source",
    uploaded: "2023-04-22T11:30:00Z",
    previewText: "The quick brown fox jumps over the lazy dog",
    previewImage: null,
  },
  {
    id: "5",
    name: "Montserrat",
    family: "Sans-serif",
    foundry: "Julieta Ulanovsky",
    variable: false,
    weights: ["Thin", "Light", "Regular", "Medium", "SemiBold", "Bold", "Black"],
    styles: ["Regular", "Italic"],
    tags: ["Sans-serif", "Geometric"],
    license: "Open Source",
    uploaded: "2023-05-25T13:20:00Z",
    previewText: "The quick brown fox jumps over the lazy dog",
    previewImage: null,
  },
  {
    id: "6",
    name: "Merriweather",
    family: "Serif",
    foundry: "Sorkin Type",
    variable: false,
    weights: ["Light", "Regular", "Bold", "Black"],
    styles: ["Regular", "Italic"],
    tags: ["Serif"],
    license: "Open Source",
    uploaded: "2023-05-15T10:45:00Z",
    previewText: "The quick brown fox jumps over the lazy dog",
    previewImage: null,
  },
];

export function FontGrid() {
  const { selectedFonts, selectFont, deselectFont, toggleSelectAll, isAllSelected } = useFontSelection();
  const [previewText, setPreviewText] = useState("The quick brown fox jumps over the lazy dog");
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {mockFonts.length} fonts
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2"
          onClick={() => toggleSelectAll(mockFonts.map(f => f.id))}
        >
          {isAllSelected(mockFonts.map(f => f.id)) ? (
            <>
              <CheckSquare className="h-4 w-4" />
              <span>Deselect All</span>
            </>
          ) : (
            <>
              <Square className="h-4 w-4" />
              <span>Select All</span>
            </>
          )}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockFonts.map((font) => (
          <FontCard
            key={font.id}
            font={font}
            previewText={previewText}
            isSelected={selectedFonts.includes(font.id)}
            onSelect={() => selectFont(font.id)}
            onDeselect={() => deselectFont(font.id)}
          />
        ))}
      </div>
    </div>
  );
}