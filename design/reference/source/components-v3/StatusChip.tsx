import { cva, type VariantProps } from 'class-variance-authority';
import type { IconType } from 'react-icons';
import { cn } from './cn';

// Source: src/components/ui/chips/status-chip.tsx. Tinted pill: word on the tone's tint, optional icon. Never colour alone.
const chip = cva('inline-flex items-center gap-1.5 font-medium whitespace-nowrap rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground',
      accent: 'bg-accent text-accent-foreground',
      info: 'bg-info-chip text-info-chip-foreground',
      success: 'bg-success-chip text-success-chip-foreground',
      warning: 'bg-warning-chip text-warning-chip-foreground',
      destructive: 'bg-destructive-chip text-destructive-chip-foreground',
    },
    size: {
      md: 'px-2.5 py-0.5 text-body-sm [&_svg]:size-3',
      sm: 'px-2.5 py-1 text-caption [&_svg]:size-3',
      xs: 'px-2 py-0.5 text-caption [&_svg]:size-2.5',
    },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});
export function StatusChip({ label, icon: Icon, tone, size, className }: VariantProps<typeof chip> & { label: string; icon?: IconType; className?: string }) {
  return (
    <span className={cn(chip({ tone, size }), className)}>
      {Icon ? <Icon aria-hidden /> : null}
      {label}
    </span>
  );
}
// <StatusChip tone="success" icon={FiCheck} label="Paid" />   <StatusChip tone="warning" icon={FiClock} label="Awaiting" />
