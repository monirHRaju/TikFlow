import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/utils.js';

const alertVariants = cva(
  'relative w-full rounded-md border px-4 py-3 text-sm flex items-start gap-3 [&>svg]:size-4 [&>svg]:mt-0.5 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground',
        info: 'border-primary/30 bg-primary/5 text-foreground',
        success:
          'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100',
        warning:
          'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100',
        destructive:
          'border-destructive/30 bg-destructive/5 text-destructive [&_*]:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type AlertProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, role = 'status', ...props }, ref) => (
    <div ref={ref} role={role} className={cn(alertVariants({ variant }), className)} {...props} />
  ),
);
Alert.displayName = 'Alert';

export const AlertTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('font-medium leading-tight', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm leading-snug opacity-90', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export const AlertContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-1 space-y-0.5', className)} {...props} />
  ),
);
AlertContent.displayName = 'AlertContent';
