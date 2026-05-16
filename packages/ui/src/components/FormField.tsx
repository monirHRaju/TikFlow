import { forwardRef, useId, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/utils.js';
import { Label } from './Label.js';

export type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  /** Help text rendered below the control. Hidden if `error` is set. */
  description?: ReactNode;
  /** Server / Zod validation message. Sets `aria-invalid` on the control. */
  error?: ReactNode;
  /** Whether the field is required (renders a visual indicator). */
  required?: boolean;
  /**
   * Render-prop receiving ids so the inner control can wire
   * `aria-describedby` / `aria-errormessage` correctly.
   */
  children: (ids: {
    id: string;
    descriptionId: string | undefined;
    errorId: string | undefined;
  }) => ReactNode;
};

/**
 * Label + control + description + error wrapper. The render-prop returns
 * the ids so the consumer can pass them to whichever control it renders
 * (Input, Select, Textarea, …) without us having to know the type.
 */
export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, label, description, error, required, children, ...props }, ref) => {
    const id = useId();
    const descriptionId = description ? `${id}-desc` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    return (
      <div ref={ref} className={cn('space-y-1.5', className)} {...props}>
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          ) : null}
        </Label>
        {children({ id, descriptionId, errorId })}
        {error ? (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        ) : description ? (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    );
  },
);
FormField.displayName = 'FormField';
