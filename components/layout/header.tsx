"use client";

import Link from "next/link";
import { ModeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { GitGraph as Typography, UploadCloud, Settings, Library, MessageSquare, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-all duration-200 ${
        scrolled ? "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" : "bg-background"
      }`}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Typography className="h-6 w-6" />
          <Link href="/" className="text-xl font-bold">
            Typeface Vault
          </Link>
        </div>

        <nav className="hidden md:flex gap-1 sm:gap-2">
          <Button variant="ghost" asChild>
            <Link href="/upload" className="flex items-center gap-2">
              <UploadCloud className="h-4 w-4" />
              <span>Upload</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/library" className="flex items-center gap-2">
              <Library className="h-4 w-4" />
              <span>Library</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Chat</span>
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Link>
          </Button>
        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <span className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="font-medium text-sm">JD</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="md:hidden" asChild>
                <Link href="/upload" className="flex items-center gap-2 cursor-pointer">
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="md:hidden" asChild>
                <Link href="/library" className="flex items-center gap-2 cursor-pointer">
                  <Library className="h-4 w-4" />
                  <span>Library</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="md:hidden" asChild>
                <Link href="/chat" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="md:hidden" asChild>
                <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}