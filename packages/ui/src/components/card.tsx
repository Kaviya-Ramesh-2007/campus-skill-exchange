import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
}

export function Card({ children, className, title, description, ...props }: CardProps) {
  const classes = ['cse-card'];
  if (className) classes.push(className);

  return (
    <section {...props} className={classes.join(' ')}>
      {(title || description) && (
        <div className="cse-card__header">
          {title && <h2 className="cse-card__title">{title}</h2>}
          {description && <p className="cse-card__description">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
