import type { HTMLAttributes, ReactNode } from 'react';

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  severity?: AlertSeverity;
  title?: ReactNode;
  children: ReactNode;
}

export function Alert({
  children,
  className,
  severity = 'info',
  title,
  role,
  ...props
}: AlertProps) {
  const classes = ['cse-alert', `cse-alert--${severity}`];
  if (className) classes.push(className);

  return (
    <div
      {...props}
      className={classes.join(' ')}
      role={role ?? (severity === 'error' ? 'alert' : 'status')}
    >
      {title && <strong className="cse-alert__title">{title}</strong>}
      <div>{children}</div>
    </div>
  );
}
