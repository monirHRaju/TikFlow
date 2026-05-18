import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../lib/utils.js';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Native <select> styled to match {@link Input}. We avoid Radix's combobox
 * here because forms picking from short, well-known lists (timezones,
 * currencies, roles) don't need search UX, and native selects give us
 * accessibility, keyboard nav, and mobile pickers for free.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'bg-[image:var(--select-chevron)] bg-[length:14px] bg-[right_0.6rem_center] bg-no-repeat pr-8 appearance-none',
        className,
      )}
      style={{
        // Inline chevron so we don't ship an icon asset for this primitive.
        // Colour follows `currentColor` via the SVG fill below.
        ['--select-chevron' as string]:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'><path d='M5.5 7.5L10 12l4.5-4.5' stroke='currentColor' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
