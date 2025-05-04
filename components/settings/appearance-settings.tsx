"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { Moon, Sun, Laptop } from "lucide-react";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [gridLayout, setGridLayout] = useState("grid");
  const [animationsEnabled, setAnimationsEnabled] = useState("enabled");

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Theme</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              className="w-full h-24 flex flex-col gap-2"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-6 w-6" />
              <span>Light</span>
            </Button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              className="w-full h-24 flex flex-col gap-2"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-6 w-6" />
              <span>Dark</span>
            </Button>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              variant={theme === "system" ? "default" : "outline"}
              className="w-full h-24 flex flex-col gap-2"
              onClick={() => setTheme("system")}
            >
              <Laptop className="h-6 w-6" />
              <span>System</span>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Select a theme preference or use your system settings.
        </p>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Font Library Layout</h3>
        <RadioGroup value={gridLayout} onValueChange={setGridLayout}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="grid" id="grid" />
            <Label htmlFor="grid">Grid View</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="list" id="list" />
            <Label htmlFor="list">List View</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="compact" id="compact" />
            <Label htmlFor="compact">Compact View</Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          Choose how fonts are displayed in your library.
        </p>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Interface Animations</h3>
        <RadioGroup value={animationsEnabled} onValueChange={setAnimationsEnabled}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="enabled" id="animations-enabled" />
            <Label htmlFor="animations-enabled">Enabled</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="reduced" id="animations-reduced" />
            <Label htmlFor="animations-reduced">Reduced</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="disabled" id="animations-disabled" />
            <Label htmlFor="animations-disabled">Disabled</Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          Adjust animation settings based on your preference.
        </p>
      </div>
      
      <div className="flex justify-end">
        <Button>Save Changes</Button>
      </div>
    </div>
  );
}