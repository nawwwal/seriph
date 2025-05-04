"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export function GeneralSettings() {
  const [notifications, setNotifications] = useState(true);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [defaultDownloadFormat, setDefaultDownloadFormat] = useState("original");

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" placeholder="example@email.com" defaultValue="designer@example.com" />
          <p className="text-sm text-muted-foreground">
            This email is used for account notifications and recovery.
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="username">Display Name</Label>
          <Input id="username" placeholder="Username" defaultValue="Designer" />
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Preferences</h3>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">Email Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive email alerts about processing status and system updates.
            </p>
          </div>
          <Switch
            id="notifications"
            checked={notifications}
            onCheckedChange={setNotifications}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-analyze">Auto-Analyze Uploads</Label>
            <p className="text-sm text-muted-foreground">
              Automatically analyze and extract metadata from uploaded fonts.
            </p>
          </div>
          <Switch
            id="auto-analyze"
            checked={autoAnalyze}
            onCheckedChange={setAutoAnalyze}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="default-download">Default Download Format</Label>
          <Select value={defaultDownloadFormat} onValueChange={setDefaultDownloadFormat}>
            <SelectTrigger id="default-download">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original Format</SelectItem>
              <SelectItem value="woff2">WOFF2</SelectItem>
              <SelectItem value="woff">WOFF</SelectItem>
              <SelectItem value="otf">OTF</SelectItem>
              <SelectItem value="ttf">TTF</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Format for downloaded fonts when not specified.
          </p>
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Account Actions</h3>
        
        <div className="space-y-2">
          <Button variant="outline">Export Account Data</Button>
          <p className="text-sm text-muted-foreground">
            Download a JSON file with your account settings and preferences.
          </p>
        </div>
        
        <div className="flex justify-end">
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}