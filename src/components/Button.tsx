import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'quiet' | 'text';
/** Old variant names, mapped onto the new set until Task 11 migrates every caller. */
type LegacyVariant = 'secondary' | 'danger' | 'ghost';

const LEGACY: Record<LegacyVariant, ButtonVariant> = { secondary: 'quiet', danger: 'text', ghost: 'text' };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | LegacyVariant;
  size?: 'regular' | 'large';
}

export function Button({ variant = 'quiet', size = 'regular', className, ...rest }: ButtonProps) {
  const resolved = variant in LEGACY ? LEGACY[variant as LegacyVariant] : (variant as ButtonVariant);
  const classes = ['button', `button--${resolved}`, size === 'large' ? 'button--large' : null, className]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...rest} />;
}
