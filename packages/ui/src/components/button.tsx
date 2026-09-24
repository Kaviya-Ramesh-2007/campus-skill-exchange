import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leadingIcon,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = ['cse-button', `cse-button--${variant}`, `cse-button--${size}`];
  if (className) classes.push(className);

  return (
    <button
      {...props}
      type={type}
      className={classes.join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="cse-button__spinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
    </button>
  );
}
