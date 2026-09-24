import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ children, className, tone = 'neutral', ...props }: BadgeProps) {
  const classes = ['cse-badge', `cse-badge--${tone}`];
  if (className) classes.push(className);

  return (
    <span {...props} className={classes.join(' ')}>
      {children}
    </span>
  );
}
