import React from 'react';
import { cn } from './cn';

// Ported from design/reference/source/components-v3/Card.tsx. A card = card colour,
// 1px hairline edge (half-strength border), 16px corners (rounded-2xl), quiet shadow-1.
export const CARD_FRAME = 'bg-card text-card-foreground border border-hairline rounded-2xl shadow-1';
export const INSET_FRAME = 'bg-muted/40 border border-hairline rounded-2xl';
export const FOOTER_GROUND = 'bg-muted/40 border-t border-hairline';
export const HERO_WASH = 'bg-card bg-[image:var(--hero-wash)]';

/** Plain card: padding 16px, children stacked with a 12px gap. */
export const Card = ({ as: Tag = 'div', className, children, ...props }) => (
    <Tag className={cn(CARD_FRAME, 'flex flex-col gap-3 p-4', className)} {...props}>
        {children}
    </Tag>
);

export const CardTitle = ({ as: Tag = 'h3', className, children }) => (
    <Tag className={cn('font-heading text-h4 text-foreground', className)}>{children}</Tag>
);

export const CardDescription = ({ className, children }) => (
    <p className={cn('text-caption text-muted-foreground', className)}>{children}</p>
);

/** A card inside a card (e.g. a summary block in a form). */
export const InsetCard = ({ className, children, ...props }) => (
    <div className={cn(INSET_FRAME, 'p-4', className)} {...props}>
        {children}
    </div>
);

/**
 * The standard content card of a page: header (title, description, actions on the right),
 * body, optional footer bar.
 * <SectionCard title="Payment methods" description="Today" actions={<Button…/>}>…</SectionCard>
 * `flush` removes the body padding (for tables and lists that run edge to edge).
 */
export const SectionCard = ({ title, description, actions, footer, flush = false, className, bodyClassName, children, ...props }) => (
    <section className={cn(CARD_FRAME, 'flex flex-col overflow-hidden', className)} {...props}>
        {(title || actions) && (
            <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
                <div className="min-w-0">
                    {title && <h3 className="font-heading text-h4 text-foreground">{title}</h3>}
                    {description && <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </header>
        )}
        <div className={cn(flush ? '' : 'px-5 pb-5', !title && !actions && !flush && 'pt-5', bodyClassName)}>{children}</div>
        {footer && <footer className={cn(FOOTER_GROUND, 'flex flex-wrap items-center justify-end gap-2 px-5 py-3')}>{footer}</footer>}
    </section>
);

export default Card;
