'use client';

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface VisitWebsiteButtonProps {
  url: string;
  className?: string;
}

export function VisitWebsiteButton({ url, className }: VisitWebsiteButtonProps) {
  const handleVisit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button
      size="sm"
      className={className}
      onClick={handleVisit}
    >
      Visit Website
      <ExternalLink className="w-4 h-4 ml-2" />
    </Button>
  );
}