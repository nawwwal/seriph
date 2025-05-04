import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GitGraph as Typography, UploadCloud, Library, MessageSquare, Settings } from "lucide-react";
import Link from "next/link";
import { HeroBanner } from "@/components/home/hero-banner";
import { FeatureHighlight } from "@/components/home/feature-highlight";

export default function Home() {
  return (
    <div className="flex flex-col gap-10 pb-16">
      <HeroBanner />
      
      <section className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureHighlight 
            icon={<UploadCloud className="h-10 w-10" />}
            title="Easy Upload"
            description="Drag and drop OTF, TTF, WOFF, and Variable font files. Batch uploads supported."
            href="/upload"
          />
          <FeatureHighlight 
            icon={<Library className="h-10 w-10" />}
            title="Visual Library"
            description="Preview all your fonts with custom text, filter, and organize your collection."
            href="/library"
          />
          <FeatureHighlight 
            icon={<MessageSquare className="h-10 w-10" />}
            title="Font Assistant"
            description="Chat with AI about your collection. Find the perfect font for any project."
            href="/chat"
          />
          <FeatureHighlight 
            icon={<Settings className="h-10 w-10" />}
            title="Customization"
            description="Personalize your experience with themes, preview text, and more."
            href="/settings"
          />
        </div>
      </section>

      <section className="container py-10">
        <Card className="overflow-hidden">
          <div className="md:flex">
            <div className="p-8 md:p-10 md:w-1/2">
              <h2 className="text-3xl font-bold mb-4">Your Personal Font Museum</h2>
              <p className="text-muted-foreground mb-6">
                Typeface Vault automatically extracts and organizes metadata, 
                creates previews, and learns your preferences to help you 
                find the perfect font for any project.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/upload">Get Started</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/library">Browse Library</Link>
                </Button>
              </div>
            </div>
            <div className="bg-muted md:w-1/2 p-8 flex items-center justify-center">
              <div className="relative w-full max-w-md">
                <Typography className="h-16 w-16 mb-4 text-primary" />
                <div className="space-y-3">
                  <div className="h-8 bg-card rounded-md w-3/4"></div>
                  <div className="h-6 bg-card rounded-md w-full"></div>
                  <div className="h-6 bg-card rounded-md w-5/6"></div>
                  <div className="h-6 bg-card rounded-md w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}