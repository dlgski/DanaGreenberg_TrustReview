import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'quiet' | 'text';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'regular' | 'large';
}

export function Button({ variant = 'quiet', size = 'regular', className, ...rest }: ButtonProps) {
  const classes = ['button', `button--${variant}`, size === 'large' ? 'button--large' : null, className]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...rest} />;
}
