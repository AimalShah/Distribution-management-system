import React from 'react';

export interface ModalShellProps {
  zIndex: number;
  maxWidth: string;
  boxClassName?: string;
  icon: React.ReactNode;
  iconClassName?: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  titleFontSize?: string;
  onClose: () => void;
  closeLabel?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  zIndex,
  maxWidth,
  boxClassName = 'modal-box',
  icon,
  iconClassName = 'w-10 h-10 rounded-xl flex items-center justify-center',
  title,
  subtitle,
  titleFontSize = '16px',
  onClose,
  closeLabel,
  bodyClassName,
  children,
  footer,
}) => {
  return (
    <div className="modal-backdrop" style={{ zIndex }}>
      <div className={boxClassName} style={{ maxWidth, width: '92%' }}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div
              className={iconClassName}
              style={{ background: 'var(--primary-light)', color: 'var(--primary-strong)' }}
            >
              {icon}
            </div>
            <div>
              <h3
                style={{ fontSize: titleFontSize, fontWeight: 700, color: 'var(--text)', margin: 0 }}
              >
                {title}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon cursor-pointer p-2"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {bodyClassName !== undefined ? <div className={bodyClassName}>{children}</div> : children}

        {footer}
      </div>
    </div>
  );
};

export interface ModalFooterProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ left, right }) => {
  return (
    <div className="modal-footer flex justify-between items-center">
      {left}
      {right}
    </div>
  );
};
