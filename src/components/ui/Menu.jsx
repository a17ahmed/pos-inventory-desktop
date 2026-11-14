import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { useFloating } from './floating';
import { useOverlay } from './overlay';

// design DESIGN_HANDOFF "Menu surface": popover, hairline, 14px radius, p-1.5, shadow-2;
// rows 32px, 7px row radius, hover = hover-overlay; destructive item last after a separator.

/**
 * <Menu
 *   trigger={<IconButton label="More actions"><FiMoreHorizontal /></IconButton>}
 *   align="end"
 *   items={[
 *     { label: 'Open bill', icon: FiFileText, onSelect: … },
 *     { heading: 'Print' },
 *     { label: 'Reprint', onSelect: … },
 *     { separator: true },
 *     { label: 'Cancel bill', icon: FiTrash2, danger: true, onSelect: … },
 *   ]}
 * />
 * Keyboard: ↑ ↓ Home End move, Enter/Space choose, Esc or Tab close.
 */
export function Menu({ trigger, items = [], align = 'start', side = 'bottom', minWidth = 200, label }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef(null);
    const panelRef = useRef(null);
    const menuId = useId();
    const pos = useFloating(open, anchorRef, panelRef, { side, align });

    useOverlay(open, panelRef, { onEscape: () => setOpen(false), autoFocus: false, trapFocus: false });

    const rows = () => Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') || []);

    // Focus the first item once placed
    useEffect(() => {
        if (open && pos) rows()[0]?.focus({ preventScroll: true });
    }, [open, pos]);

    // Click outside closes
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (!panelRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const onKeyDown = (e) => {
        const list = rows();
        const i = list.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            list[(i + 1) % list.length]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            list[(i - 1 + list.length) % list.length]?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            list[0]?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            list[list.length - 1]?.focus();
        } else if (e.key === 'Tab') {
            setOpen(false);
        }
    };

    const choose = (item) => {
        if (item.disabled) return;
        setOpen(false);
        // After the menu closes and focus returns to the trigger
        setTimeout(() => item.onSelect?.(), 0);
    };

    const triggerEl = React.cloneElement(trigger, {
        ref: anchorRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: (e) => {
            trigger.props.onClick?.(e);
            setOpen((v) => !v);
        },
    });

    return (
        <>
            {triggerEl}
            {open
                ? createPortal(
                      <div
                          ref={panelRef}
                          id={menuId}
                          role="menu"
                          aria-label={label}
                          onKeyDown={onKeyDown}
                          style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth, zIndex: 9500 }}
                          className="bg-popover text-popover-foreground border border-hairline rounded-pop p-1.5 shadow-2 animate-ds-menu-in max-h-[70vh] overflow-y-auto outline-none print:hidden"
                      >
                          {items.map((item, idx) => {
                              if (item.separator) return <div key={`sep-${idx}`} role="separator" className="my-1 -mx-1.5 h-px bg-hairline" />;
                              if (item.heading)
                                  return (
                                      <div key={`h-${idx}`} className="h-8 px-2.5 flex items-center text-body-sm text-muted-foreground">
                                          {item.heading}
                                      </div>
                                  );
                              const Icon = item.icon;
                              return (
                                  <div
                                      key={item.key || item.label}
                                      role="menuitem"
                                      tabIndex={-1}
                                      aria-disabled={item.disabled || undefined}
                                      onClick={() => choose(item)}
                                      onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              choose(item);
                                          }
                                      }}
                                      onMouseEnter={(e) => !item.disabled && e.currentTarget.focus({ preventScroll: true })}
                                      className={cn(
                                          'min-h-8 px-2.5 flex items-center gap-2 rounded-[7px] text-body cursor-pointer select-none outline-none',
                                          'focus:bg-[var(--hover-overlay)]',
                                          item.danger ? 'text-destructive' : 'text-foreground',
                                          item.disabled && 'opacity-50 cursor-not-allowed'
                                      )}
                                  >
                                      {Icon ? <Icon className="w-3.5 h-3.5 flex-none" aria-hidden="true" /> : null}
                                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                                      {item.hint ? <span className="text-body-sm text-muted-foreground">{item.hint}</span> : null}
                                  </div>
                              );
                          })}
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
}

export default Menu;
