import React from 'react';
import { AlertTriangleIcon, InfoIcon, ShieldIcon } from '../icons';

export interface AlertProps {
  variant?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  className = '',
}) => {
  const styles = {
    info: {
      container: 'bg-cyan-950/40 border-cyan-800/60 text-cyan-200',
      icon: <InfoIcon className="text-cyan-400 shrink-0" size={18} />,
      titleColor: 'text-cyan-300',
    },
    warning: {
      container: 'bg-amber-950/40 border-amber-800/60 text-amber-200',
      icon: <AlertTriangleIcon className="text-amber-400 shrink-0" size={18} />,
      titleColor: 'text-amber-300',
    },
    danger: {
      container: 'bg-rose-950/40 border-rose-800/60 text-rose-200',
      icon: <AlertTriangleIcon className="text-rose-400 shrink-0" size={18} />,
      titleColor: 'text-rose-300',
    },
    success: {
      container: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200',
      icon: <ShieldIcon className="text-emerald-400 shrink-0" size={18} />,
      titleColor: 'text-emerald-300',
    },
  };

  const current = styles[variant];

  return (
    <div className={`p-3.5 rounded-md border flex items-start gap-3 text-xs leading-relaxed ${current.container} ${className}`}>
      {current.icon}
      <div className="space-y-0.5 flex-1">
        {title && <h5 className={`font-semibold tracking-wide uppercase ${current.titleColor}`}>{title}</h5>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
};

