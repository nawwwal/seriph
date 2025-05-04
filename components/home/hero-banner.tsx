"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GitGraph as Typography, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-card py-20">
      <div className="container flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography className="h-16 w-16 mb-4 text-primary" />
        </motion.div>
        
        <motion.h1 
          className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Your AI-Assisted Font Collection
        </motion.h1>
        
        <motion.p 
          className="text-xl text-muted-foreground mb-8 max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Upload, organize, preview, and chat about your typefaces — all in one place.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Button asChild size="lg" className="flex gap-2 items-center">
            <Link href="/upload">
              <UploadCloud className="h-5 w-5" />
              <span>Upload Fonts</span>
            </Link>
          </Button>
        </motion.div>
      </div>
      
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50"></div>
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[length:32px_32px]"></div>
      </div>
    </section>
  );
}