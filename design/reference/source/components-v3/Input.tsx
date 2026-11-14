import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './cn';

// Source: src/components/ui/input.tsx
const inputVariants = cva(
  'flex w-full rounded-sm border px-3 py-1 text-body-lg placeholder:text-placeholder placeholder:text-body transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:placeholder:text-transparent aria-[invalid=true]:border-destructive',
  {
    variants: {
      variant: {
        outline: 'border-input bg-transparent',
        tinted: 'border-border bg-card',
        filled: 'bg-muted border-transparent shadow-[inset_0_-1px_0_var(--input)]',
      },
      size: { default: 'h-9', xs: 'h-8', action: 'min-h-10', xl: 'min-h-11' },
      font: { sans: '', mono: 'font-mono' },
    },
    defaultVariants: { variant: 'outline', size: 'default', font: 'sans' },
  },
);
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, VariantProps<typeof inputVariants> {}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, variant, size, font, ...props }, ref) => (
  <input ref={ref} className={cn(inputVariants({ variant, size, font }), className)} {...props} />
));
Input.displayName = 'Input';
