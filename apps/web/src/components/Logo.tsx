import { cn } from '@tikflow/ui';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shadow-sm"
      >
        T
      </span>
      <span className="font-semibold tracking-tight">TikFlow</span>
    </div>
  );
}
