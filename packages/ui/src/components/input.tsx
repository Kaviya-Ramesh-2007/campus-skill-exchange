import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const descriptionId = id ? `${id}-description` : undefined;
  const errorId = id ? `${id}-error` : undefined;
  const describedBy =
    [hint ? descriptionId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') ||
    undefined;
  const classes = ['cse-field'];
  if (className) classes.push(className);

  return (
    <label className={classes.join(' ')} htmlFor={id}>
      <span className="cse-field__label">{label}</span>
      <input
        {...props}
        id={id}
        className="cse-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <span id={descriptionId} className="cse-field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="cse-field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
