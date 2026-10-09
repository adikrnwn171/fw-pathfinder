import { cn } from '@/utils/utils'

const styles: Record<string, string> = {
  RESOLVED: 'bg-success-foreground text-success border-success/30',
  REJECTED: 'bg-danger-foreground text-danger border-danger/30',
  PARTIAL: 'bg-warning-foreground text-warning border-warning/30',
  PENDING: 'bg-secondary text-muted-foreground border-border',
  IN_REVIEW: 'bg-accent text-accent-foreground border-accent-foreground/20',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-sm border px-2 py-0.5 font-mono text-xs font-semibold tracking-wide',
        styles[status] ?? 'bg-secondary text-muted-foreground border-border',
      )}
    >
      {status}
    </span>
  )
}