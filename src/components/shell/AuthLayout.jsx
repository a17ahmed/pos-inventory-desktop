import React from 'react';
import { FiCheck } from 'react-icons/fi';
import { cn } from '../ui';

// Sign-in / sign-up frame (design/reference/light/33-auth-sign-in.png): a tinted brand panel on
// the left with what the app does, the form card on the right. Below 1024px only the card shows.

export const BrandMark = ({ className }) => (
    <span className={cn('w-10 h-10 flex-none rounded-xl bg-primary text-primary-foreground inline-flex items-center justify-center', className)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" className="w-5 h-5" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
        </svg>
    </span>
);

const POINTS = [
    ['Quick checkout', 'Scan, take cash, card or credit, print the receipt.'],
    ['Stock that keeps itself', 'Sales take stock out, supplies put it back. Low stock shows up first.'],
    ['Money you can check', 'Customer balances, the cash drawer and a daily closing that adds up.'],
];

export function AuthLayout({ children, footer }) {
    return (
        <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Brand panel */}
            <aside className="ds-band relative hidden lg:flex flex-col justify-between overflow-hidden bg-surface-tint border-r border-hairline px-12 py-10">
                <div className="relative flex items-center gap-3">
                    <BrandMark className="w-8 h-8 rounded-lg [&_svg]:w-4 [&_svg]:h-4" />
                    <span className="font-mono text-overline-lg uppercase tracking-wide text-muted-foreground">Point of sale</span>
                </div>
                <div className="relative max-w-[460px]">
                    <h2 className="font-heading text-display text-foreground">
                        Every sale rung up once.
                        <br />
                        Every rupee accounted for.
                    </h2>
                    <p className="mt-4 text-body-lg text-muted-foreground">
                        Sales, stock, customers and money for your shop, on every counter.
                    </p>
                    <ul className="mt-8 flex flex-col gap-4">
                        {POINTS.map(([title, text]) => (
                            <li key={title} className="flex items-start gap-3">
                                <span className="mt-0.5 w-6 h-6 flex-none rounded-full bg-accent text-accent-foreground inline-flex items-center justify-center">
                                    <FiCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                </span>
                                <span>
                                    <span className="block text-body-lg font-medium text-foreground">{title}</span>
                                    <span className="block text-body text-muted-foreground">{text}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <span />
            </aside>

            {/* Form */}
            <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
                <div className="w-full max-w-[420px]">
                    {children}
                    {footer ? <div className="mt-5 text-center text-caption text-muted-foreground">{footer}</div> : null}
                </div>
            </main>
        </div>
    );
}

/** The white card with the accent edge on top. */
export const AuthCard = ({ children, className }) => (
    <div className={cn('bg-card text-card-foreground border border-hairline border-t-[3px] border-t-primary rounded-2xl shadow-2 px-7 py-7', className)}>
        {children}
    </div>
);

export default AuthLayout;
