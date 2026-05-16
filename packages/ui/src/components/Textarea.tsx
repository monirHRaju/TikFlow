import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../lib/utils.js';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'resize-y min-h-[5rem]',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
