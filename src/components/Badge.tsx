import './Badge.css';

export type BadgeVariant = 'neutral' | 'success' | 'caution' | 'danger' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
