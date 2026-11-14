import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { cn } from './cn';

// DESIGN_HANDOFF "Page header (AppPage)" — components/layout-01-apppage.png.
// The page's one H1 lives here (the top bar only shows the breadcrumb).
//   List page:   title, muted subtitle, primary action right.
//   Record page: back link, code + status chip, title, one meta line, actions, tabs.

/**
 * <PageHeader
 *   back={{ to: '/customers', label: 'Customers' }}   // or { onClick, label }
 *   eyebrow="CUSTOMER · C-0142"  meta={<StatusBadge …/>}
 *   title="Ali Traders"  subtitle="Credit limit Rs 50,000 · 12 open bills"
 *   actions={<Button>Take payment</Button>}
 *   tabs={<Tabs … />}
 * />
 */
export function PageHeader({ back, eyebrow, meta, title, subtitle, actions, tabs, className, children }) {
    return (
        <header
            className={cn(
                'ds-band relative overflow-hidden rounded-2xl border border-hairline bg-surface-tint px-[22px] pt-5 mb-5',
                tabs ? 'pb-0' : 'pb-5',
                'print:bg-transparent print:border-0 print:px-0 print:pt-0 print:pb-2 print:mb-2',
                className
            )}
        >
            <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1">
                    {back ? (
                        back.to ? (
                            <Link
                                to={back.to}
                                className="mb-2 inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring print:hidden"
                            >
                                <FiArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                                {back.label}
                            </Link>
                        ) : (
                            <button
                                type="button"
                                onClick={back.onClick}
                                className="mb-2 inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring print:hidden"
                            >
                                <FiArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                                {back.label}
                            </button>
                        )
                    ) : null}
                    {eyebrow || meta ? (
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            {eyebrow ? <span className="font-mono text-mono-xs uppercase tracking-wide text-muted-foreground">{eyebrow}</span> : null}
                            {meta}
                        </div>
                    ) : null}
                    <h1 className="font-heading text-h2 text-foreground break-words">{title}</h1>
                    {subtitle ? <div className="mt-1 max-w-[78ch] text-body text-muted-foreground">{subtitle}</div> : null}
                    {children}
                </div>
                {actions ? <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div> : null}
            </div>
            {tabs ? <div className="relative mt-4 -mx-1">{React.cloneElement(tabs, { bordered: false })}</div> : null}
        </header>
    );
}

export default PageHeader;
