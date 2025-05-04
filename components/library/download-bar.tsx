"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFontSelection } from "@/hooks/use-font-selection";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";

export function DownloadBar() {
  const { selectedFonts, clearSelection } = useFontSelection();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleDownload = () => {
    if (selectedFonts.length === 0) return;
    
    setDownloading(true);
    setProgress(0);
    
    // Simulate download progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setDownloading(false);
            clearSelection();
          }, 500);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };
  
  // Reset progress when selection changes
  useEffect(() => {
    if (!downloading) {
      setProgress(0);
    }
  }, [selectedFonts, downloading]);

  if (selectedFonts.length === 0 && !downloading) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50"
      >
        <div className="container mx-auto px-4 pb-6">
          <div className="bg-card shadow-lg border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <span className="font-medium">
                {downloading 
                  ? `Downloading ${selectedFonts.length} font${selectedFonts.length !== 1 ? 's' : ''}...` 
                  : `${selectedFonts.length} font${selectedFonts.length !== 1 ? 's' : ''} selected`}
              </span>
              
              {downloading && (
                <div className="flex-1 max-w-xs">
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {!downloading && (
                <>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Cancel
                  </Button>
                  <Button size="sm" className="gap-2" onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </Button>
                </>
              )}
              
              {downloading && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    clearInterval();
                    setDownloading(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}