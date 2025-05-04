"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function LibraryControls() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Mock tags for demonstration
  const availableTags = [
    "Sans-serif", "Serif", "Monospace", "Display", 
    "Script", "Handwritten", "Geometric", "Humanist", 
    "Grotesque", "Slab"
  ];
  
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  const clearFilters = () => {
    setSelectedTags([]);
  };

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fonts..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        <div className="flex gap-3">
          <Select defaultValue="newest">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
            </SelectContent>
          </Select>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filter</span>
                {selectedTags.length > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {selectedTags.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Fonts</SheetTitle>
              </SheetHeader>
              <div className="py-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Tags</h3>
                  {selectedTags.length > 0 && (
                    <Button 
                      variant="ghost"
                      size="sm" 
                      onClick={clearFilters}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {availableTags.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`tag-${tag}`} 
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={() => toggleTag(tag)}
                      />
                      <Label 
                        htmlFor={`tag-${tag}`}
                        className="text-sm cursor-pointer"
                      >
                        {tag}
                      </Label>
                    </div>
                  ))}
                </div>
                
                <Separator className="my-6" />
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Font Properties</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="weight-select" className="text-xs">Weight</Label>
                    <Select>
                      <SelectTrigger id="weight-select">
                        <SelectValue placeholder="Any weight" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any weight</SelectItem>
                        <SelectItem value="thin">Thin</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="semibold">Semibold</SelectItem>
                        <SelectItem value="bold">Bold</SelectItem>
                        <SelectItem value="black">Black</SelectItem>
                        <SelectItem value="variable">Variable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="license-select" className="text-xs">License Type</Label>
                    <Select>
                      <SelectTrigger id="license-select">
                        <SelectValue placeholder="Any license" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any license</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="opensource">Open Source</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filters:</span>
          {selectedTags.map(tag => (
            <Button
              key={tag}
              variant="secondary"
              size="sm"
              className="h-6 pl-2 pr-1 py-0 text-xs gap-1"
              onClick={() => toggleTag(tag)}
            >
              {tag}
              <X className="h-3 w-3" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 py-0 text-xs"
            onClick={clearFilters}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}