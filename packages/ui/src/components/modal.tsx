'use client';

import { useEffect, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
}

export function Modal({ open, title, children, onClose, closeLabel = 'Close' }: ModalProps) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="cse-modal__backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="cse-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cse-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="cse-modal__header">
          <h2 id="cse-modal-title">{title}</h2>
          <button
            type="button"
            className="cse-modal__close"
            onClick={onClose}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
        <div className="cse-modal__body">{children}</div>
      </div>
    </div>
  );
}
