import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge'; // v2.x for Tailwind 3

// Register the type-ladder role names, or tailwind-merge reads `text-caption` as a colour.
const TYPE_ROLES = ['micro','caption','body-sm','body','body-lg','lead','label','h5','h4','h3','h2','h1','display','overline','overline-md','overline-lg','overline-xl','mono-2xs','mono-xs','mono-sm','mono','mono-lg','th'];
const twMerge = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: TYPE_ROLES }] } } });
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
