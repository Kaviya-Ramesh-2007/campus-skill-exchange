import type { HTMLAttributes } from 'react';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ name, src, size = 'md', className, ...props }: AvatarProps) {
  const classes = ['cse-avatar', `cse-avatar--${size}`];
  if (className) classes.push(className);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span {...props} className={classes.join(' ')} aria-label={name} role="img">
      {src ? (
        <img src={src} alt="" className="cse-avatar__image" />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
