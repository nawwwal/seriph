import Link from "next/link";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface FeatureHighlightProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

export function FeatureHighlight({
  icon,
  title,
  description,
  href,
}: FeatureHighlightProps) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-md">
      <CardContent className="pt-6">
        <div className="mb-4 text-primary">{icon}</div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter className="pb-4">
        <Button variant="ghost" className="p-0 h-auto" asChild>
          <Link href={href} className="flex items-center gap-1 text-primary">
            <span>Learn more</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}