// Joins class names, skipping falsy values: cn('a', ok && 'b', null) → 'a b'.
// No tailwind-merge: a component's own classes and a `className` passed in can't
// "override" each other reliably, so pass layout classes (margin, width, flex)
// through `className`, and use the component's props for its look.
export const cn = (...parts) => parts.flat().filter(Boolean).join(' ');

export default cn;
