import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary/15 text-primary',
        secondary:
          'border-border bg-secondary text-secondary-foreground',
        destructive:
          'border-destructive/40 bg-destructive/10 text-destructive',
        outline: 'border-border text-muted-foreground',
        safe: 'border-safe/40 bg-safe/10 text-safe',
        warn: 'border-warn/40 bg-warn/10 text-warn',
        muted:
          'border-border/70 bg-muted/40 text-muted-foreground border-dashed',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
