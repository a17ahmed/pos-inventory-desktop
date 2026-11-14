// Plain-React switch following switch.tsx's geometry: track 46x28 (xs: 36x20), 3px padding, 20px knob (xs 14px),
// checked = bg-primary, unchecked = bg-secondary + 1px --input border, knob = --knob with --knob-shadow, 120ms slide.
import { cn } from './cn';
export function Switch({ checked, onChange, size = 'default', label }: { checked: boolean; onChange: (v: boolean) => void; size?: 'default' | 'xs'; label: string }) {
  const xs = size === 'xs';
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50">
      <span className={cn('inline-flex items-center rounded-full border p-[3px] transition-colors', checked ? 'bg-primary border-primary' : 'bg-secondary border-input', xs ? 'h-5 w-9' : 'h-7 w-[46px]')}>
        <span className={cn('block rounded-full bg-[var(--knob)] shadow-knob [transition:transform_120ms_ease]', xs ? 'size-3.5' : 'size-5', checked && (xs ? 'translate-x-[14px]' : 'translate-x-[18px]'))} />
      </span>
    </button>
  );
}
