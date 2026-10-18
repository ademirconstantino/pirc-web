import { ReactNode, useEffect, useRef } from 'react';

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** image shown on top of the dialog, as in the Swing version */
  banner?: string;
  width?: number;
}

/** A modal dialog, port of the pIRC JDialogs */
export default function Dialog({ title, onClose, children, banner, width = 456 }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, button:not(.dialog-close)');
    first?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      >
        <div className="frame-titlebar dialog-titlebar">
          <span className="frame-title">{title}</span>
          <button type="button" className="frame-button dialog-close" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </div>
        {banner && (
          <div className="dialog-banner">
            <img src={banner} alt="" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
