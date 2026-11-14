import type { IconType } from 'react-icons';
import { cn } from './cn';

// Source: alert.tsx (Banner). One line, tone + optional action. Tone tints come from the *-chip tokens.
const TONE = {
  neutral: 'bg-muted/50 border-border text-foreground',
  info: 'bg-info-chip border-info-chip-foreground/20 text-info-chip-foreground',
  success: 'bg-success-chip border-success-chip-foreground/20 text-success-chip-foreground',
  warning: 'bg-warning-chip border-warning-chip-foreground/25 text-warning-chip-foreground',
  destructive: 'bg-destructive-chip border-destructive/30 text-destructive-chip-foreground',
} as const;
export function Banner({ tone = 'neutral', icon: Icon, children, action }: { tone?: keyof typeof TONE; icon?: IconType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div role="status" className={cn('text-body flex min-h-9 w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-1.5', TONE[tone])}>
      {Icon ? <Icon aria-hidden className="size-4 flex-none" /> : null}
      <div className="min-w-0 flex-1 text-pretty">{children}</div>
      {action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
    </div>
  );
}
