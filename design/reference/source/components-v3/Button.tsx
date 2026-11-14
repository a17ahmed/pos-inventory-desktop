import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './cn';

// Source: src/components/ui/button.tsx. Tailwind 3 translation: `bg-(--x)` -> `bg-[var(--x)]`,
// `not-disabled:` / `not-aria-busy:` come from the plugin in tailwind.config.js, `outline-solid` -> default outline.
const PRESS = 'not-disabled:not-aria-busy:active:[transform:var(--press-shift)]';
const BRIGHT = `not-disabled:not-aria-busy:hover:[filter:var(--hover-brighten)] not-disabled:not-aria-busy:active:[filter:var(--press-brighten)] ${PRESS}`;
const WASH = `not-disabled:not-aria-busy:hover:bg-[var(--hover-overlay)] not-disabled:not-aria-busy:active:bg-[var(--press-overlay)] ${PRESS}`;

export const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm text-center text-body-lg font-medium text-balance transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress aria-busy:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground ${BRIGHT}`,
        destructive: `bg-destructive text-destructive-foreground ${BRIGHT}`,
        warning: `bg-warning text-warning-foreground ${BRIGHT}`,
        outline: `border border-border bg-card ${WASH}`,
        secondary: `bg-secondary text-secondary-foreground ${WASH}`,
        ghost: `text-muted-foreground text-body ${WASH}`,
        link: 'h-auto min-h-0 p-0 text-body-sm text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2', //                36px  toolbar / dense
        xs: 'h-8 px-2.5 [&_svg]:size-3.5', //       32px  tabs, pager
        '2xs': 'size-7 shrink-0 [&_svg]:size-3.5', // 28px  icon inside another control
        action: 'min-h-10 px-4 py-2', //            40px  settings action row
        sm: 'min-h-11 px-3 py-2 text-body', //      44px floor at 13px type (in-app)
        xl: 'min-h-11 px-4 py-2', //                44px floor at 14px type (auth / forms)
        icon: 'size-11 shrink-0', //                44px square icon-only
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size: variant === 'link' ? null : size }), className)} {...props} />
));
Button.displayName = 'Button';
// Icon-only usage:  <Button variant="outline" size="icon" aria-label="Refresh"><FiRefreshCw /></Button>
// react-icons Feather icons take `size` from the parent's [&_svg]:size-4; stroke width is Feather's default 2.
