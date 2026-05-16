import { cn } from '@tikflow/ui';

type Props = {
  className?: string;
  /**
   * Tenant-supplied logo URL. When present, replaces the default
   * TikFlow "T" badge. Rendered with `referrerpolicy=no-referrer`.
   */
  logoUrl?: string | null;
};

export function Logo({ className, logoUrl }: Props) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-7 w-auto max-w-[120px] rounded"
        />
      ) : (
        <>
          <span
            aria-hidden
            className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shadow-sm"
          >
            T
          </span>
          <span className="font-semibold tracking-tight">TikFlow</span>
        </>
      )}
    </div>
  );
}
