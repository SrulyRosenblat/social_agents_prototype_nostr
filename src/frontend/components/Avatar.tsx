import { cn } from '@/lib/utils';
import { hueOf, initialsOf } from '@/lib/avatar';

interface AvatarProps {
  name: string | undefined | null;
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ring?: 'safe' | 'destructive' | 'muted' | 'none';
}

const sizeMap = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

const ringMap: Record<NonNullable<AvatarProps['ring']>, string> = {
  none: '',
  safe: 'ring-1 ring-safe/60',
  destructive: 'ring-1 ring-destructive/60',
  muted: 'ring-1 ring-border',
};

export function Avatar({ name, seed, size = 'md', className, ring = 'none' }: AvatarProps) {
  const hue = hueOf(seed ?? name ?? 'anon');
  const bg = `hsl(${hue} 65% 22%)`;
  const fg = `hsl(${hue} 90% 78%)`;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizeMap[size],
        ringMap[ring],
        className,
      )}
      style={{ background: bg, color: fg }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
