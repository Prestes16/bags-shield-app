"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TokenAvatarProps {
  imageUrl?: string;
  symbol?: string;
  size?: number;
  className?: string;
}

/**
 * TokenAvatar: renders token icon with fallback
 * - If imageUrl exists and loads: shows image
 * - Else: shows circular neon outline with symbol initials
 */
export function TokenAvatar({ imageUrl, symbol, size = 36, className }: TokenAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sizeClass = `w-${size} h-${size}`;
  const initials = symbol
    ? symbol
        .slice(0, 2)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
    : "?";

  // If imageUrl exists and hasn't errored, try to show image
  if (imageUrl && !imageError) {
    return (
      <div className={cn("relative shrink-0 rounded-full overflow-hidden", sizeClass, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={symbol ? `${symbol} token` : "Token"}
          className={cn(
            "w-full h-full object-cover",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(false);
          }}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 bg-surface/30 animate-pulse" />
        )}
      </div>
    );
  }

  // Fallback: circular neon outline with initials
  return (
    <div
      className={cn(
        "shrink-0 rounded-full border-2 border-primary/40 bg-surface/30 backdrop-blur-sm",
        "flex items-center justify-center font-semibold text-primary",
        "shadow-[0_0_12px_rgba(6,182,212,0.2)]",
        sizeClass,
        className
      )}
      style={{ fontSize: `${size * 0.4}px` }}
    >
      {initials}
    </div>
  );
}
