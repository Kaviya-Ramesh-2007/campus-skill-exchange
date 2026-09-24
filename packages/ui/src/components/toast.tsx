import type { ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  className?: string;
}

export function Toast({ title, description, tone = 'info', className }: ToastProps) {
  const classes = ['cse-toast', `cse-toast--${tone}`];
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  );
}
