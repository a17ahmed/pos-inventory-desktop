import React, { useId } from 'react';
import { cn } from './cn';

/**
 * Label + one control + help text or error. Wires id / aria-describedby / aria-invalid onto
 * the control for you:
 *   <Field label="Amount" hint="In PKR" error={err}><Input value… /></Field>
 */
export const Field = ({ label, hint, error, required, optional, className, children }) => {
    const autoId = useId();
    const child = React.Children.only(children);
    const id = child.props.id || autoId;
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [child.props['aria-describedby'], errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            {label && (
                <label htmlFor={id} className="text-body-sm font-medium text-foreground">
                    {label}
                    {required && <span className="text-destructive" aria-hidden="true"> *</span>}
                    {optional && <span className="font-normal text-muted-foreground"> (optional)</span>}
                </label>
            )}
            {React.cloneElement(child, {
                id,
                'aria-describedby': describedBy,
                'aria-invalid': error ? true : child.props['aria-invalid'],
                required: required || child.props.required,
            })}
            {error ? (
                <p id={errorId} className="text-caption text-destructive">{error}</p>
            ) : hint ? (
                <p id={hintId} className="text-caption text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
};

export default Field;
