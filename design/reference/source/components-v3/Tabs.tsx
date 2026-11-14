// Underline tab strip (tabs.tsx variant="underline"): 18px gaps, 1px bottom border, 44px min-height triggers,
// active = foreground text + 2px primary bar on the bottom edge. Count pill: caption, rounded-full, tabular-nums.
import { cn } from './cn';
export function UnderlineTabs<T extends string>({ items, value, onChange }: { items: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="border-border flex min-w-0 items-end justify-start gap-[18px] overflow-x-auto border-b px-1">
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={cn("relative inline-flex min-h-11 flex-none items-center gap-2 whitespace-nowrap px-0.5 text-body font-medium transition-colors focus-visible:outline-none",
              "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:content-['']",
              on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground after:opacity-0')}>
            {t.label}
            {t.count === undefined ? null : (
              <span className={cn('text-caption min-w-5 rounded-full px-1.5 py-0.5 text-center font-semibold tabular-nums', on ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
