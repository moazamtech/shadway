'use client';

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { addRefParameter } from "@/lib/utils/url";

interface VisitWebsiteButtonProps {
  url: string;
  className?: string;
  addRef?: boolean;
}

export function VisitWebsiteButton({ url, className, addRef = true }: VisitWebsiteButtonProps) {
  const handleVisit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const finalUrl = addRef ? addRefParameter(url) : url;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
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