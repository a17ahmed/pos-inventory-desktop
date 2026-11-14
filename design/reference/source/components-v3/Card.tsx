import * as React from 'react';
import { cn } from './cn';

// Source: card.tsx + card-surface.ts. A card = card colour, 50% border (hairline), 16px radius, soft shadow.
export const CARD_FRAME = 'bg-card border border-hairline rounded-lg shadow-1';
export const INSET_FRAME = 'bg-muted/40 border border-hairline rounded-lg';
export const FOOTER_GROUND = 'bg-muted/40 border-t border-hairline';
export const HERO_WASH = 'bg-card bg-[image:var(--hero-wash)]';

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn(CARD_FRAME, 'text-card-foreground flex flex-col gap-3 p-4', className)} {...p} />
);
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('font-heading text-h4', className)} {...p} />
);
export const CardDescription = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('text-muted-foreground text-caption text-pretty', className)} {...p} />
);
