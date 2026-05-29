import { hueOf, initialsOf } from '../avatar';

interface AvatarProps {
  name: string | undefined | null;
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
  ring?: 'safe' | 'destructive' | 'muted' | 'none';
}

const sizeMap = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' };
const ringMap = {
  none: '',
  safe: 'ring-2 ring-[hsl(var(--safe))]/60',
  destructive: 'ring-2 ring-[hsl(var(--destructive))]/60',
  muted: 'ring-2 ring-[hsl(var(--border))]',
};

export function Avatar({ name, seed, size = 'md', ring = 'none' }: AvatarProps) {
  const hue = hueOf(seed ?? name ?? 'anon');
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizeMap[size]} ${ringMap[ring]}`}
      style={{
        background: `hsl(${hue} 65% 22%)`,
        color: `hsl(${hue} 90% 78%)`,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
