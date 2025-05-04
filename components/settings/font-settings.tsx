"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export function FontSettings() {
  const [previewText, setPreviewText] = useState("The quick brown fox jumps over the lazy dog");
  const [previewSize, setPreviewSize] = useState([24]);
  const [showGlyphMap, setShowGlyphMap] = useState(true);
  const [defaultSort, setDefaultSort] = useState("date-added-desc");

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Font Preview</h3>
        
        <div className="space-y-2">
          <Label htmlFor="preview-text">Default Preview Text</Label>
          <Textarea
            id="preview-text"
            placeholder="Enter text for font previews"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            This text will be used to preview fonts in the library.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Preview Font Size</Label>
              <span className="text-sm">{previewSize[0]}px</span>
            </div>
            <Slider
              min={12}
              max={72}
              step={1}
              value={previewSize}
              onValueChange={setPreviewSize}
            />
            <p className="text-sm text-muted-foreground">
              Adjust the font size used in preview cards.
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="show-glyph-map">Show Glyph Map</Label>
            <p className="text-sm text-muted-foreground">
              Display a character map when viewing font details.
            </p>
          </div>
          <Switch
            id="show-glyph-map"
            checked={showGlyphMap}
            onCheckedChange={setShowGlyphMap}
          />
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Library Display</h3>
        
        <div className="space-y-2">
          <Label htmlFor="default-sort">Default Sort Order</Label>
          <Select value={defaultSort} onValueChange={setDefaultSort}>
            <SelectTrigger id="default-sort">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-added-desc">Newest First</SelectItem>
              <SelectItem value="date-added-asc">Oldest First</SelectItem>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="weight-asc">Weight (Light to Heavy)</SelectItem>
              <SelectItem value="weight-desc">Weight (Heavy to Light)</SelectItem>
              <SelectItem value="preference">My Preference</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            How fonts are sorted when viewing your library.
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="cards-per-row">Font Cards per Row</Label>
          <Input
            id="cards-per-row"
            type="number"
            min="1"
            max="8"
            defaultValue="3"
          />
          <p className="text-sm text-muted-foreground">
            Number of font cards to display per row on desktop.
          </p>
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button>Save Changes</Button>
      </div>
    </div>
  );
}