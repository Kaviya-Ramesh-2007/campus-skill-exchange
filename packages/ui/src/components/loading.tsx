import type { HTMLAttributes, ReactNode } from 'react';

export interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
}

export function Loading({ label = 'Loading', className, ...props }: LoadingProps) {
  const classes = ['cse-loading'];
  if (className) classes.push(className);

  return (
    <div {...props} className={classes.join(' ')} role="status" aria-live="polite">
      <span className="cse-loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
