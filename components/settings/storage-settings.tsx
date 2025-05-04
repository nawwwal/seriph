"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function StorageSettings() {
  const [autoCleanup, setAutoCleanup] = useState(false);
  const [cleanupDays, setCleanupDays] = useState([30]);
  
  // Mock storage usage
  const totalStorage = 10; // GB
  const usedStorage = 3.7; // GB
  const usedPercentage = (usedStorage / totalStorage) * 100;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Storage Usage</h3>
        
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Used {usedStorage} GB of {totalStorage} GB</span>
            <span>{Math.round(usedPercentage)}%</span>
          </div>
          <Progress value={usedPercentage} className="h-2" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-muted rounded-md">
            <div className="text-sm font-medium mb-1">Font Files</div>
            <div className="text-2xl font-bold mb-1">2.8 GB</div>
            <div className="text-sm text-muted-foreground">143 files</div>
          </div>
          <div className="p-4 bg-muted rounded-md">
            <div className="text-sm font-medium mb-1">Previews & Cache</div>
            <div className="text-2xl font-bold mb-1">0.9 GB</div>
            <div className="text-sm text-muted-foreground">286 files</div>
          </div>
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Storage Management</h3>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-cleanup">Automatic Cleanup</Label>
            <p className="text-sm text-muted-foreground">
              Automatically remove unused preview files and temporary storage.
            </p>
          </div>
          <Switch
            id="auto-cleanup"
            checked={autoCleanup}
            onCheckedChange={setAutoCleanup}
          />
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Remove Unused Files After</Label>
              <span className="text-sm">{cleanupDays[0]} days</span>
            </div>
            <Slider
              min={7}
              max={90}
              step={1}
              value={cleanupDays}
              onValueChange={setCleanupDays}
              disabled={!autoCleanup}
            />
            <p className="text-sm text-muted-foreground">
              Files that haven't been accessed within this period will be removed.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <Button variant="outline">Clean Preview Cache</Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete All Fonts</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all your font files
                  from our servers and remove all associated metadata and previews.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground">
                  Delete All Fonts
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      
      <Separator />
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Export & Backup</h3>
        
        <div className="space-y-2">
          <Button variant="outline">Export Font Collection Data</Button>
          <p className="text-sm text-muted-foreground">
            Export a JSON manifest of your font collection for backup or use in design tools.
          </p>
        </div>
      </div>
    </div>
  );
}