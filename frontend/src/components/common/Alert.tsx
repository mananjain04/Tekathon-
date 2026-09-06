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
      container: 'bg-blue-50/90 border-blue-200 text-blue-950 shadow-sm backdrop-blur-md',
      icon: <InfoIcon className="text-blue-700 shrink-0" size={18} />,
      titleColor: 'text-blue-950 font-bold',
    },
    warning: {
      container: 'bg-amber-50/90 border-amber-200 text-amber-950 shadow-sm backdrop-blur-md',
      icon: <AlertTriangleIcon className="text-amber-700 shrink-0" size={18} />,
      titleColor: 'text-amber-950 font-bold',
    },
    danger: {
      container: 'bg-rose-50/90 border-rose-200 text-rose-950 shadow-sm backdrop-blur-md',
      icon: <AlertTriangleIcon className="text-rose-700 shrink-0" size={18} />,
      titleColor: 'text-rose-950 font-bold',
    },
    success: {
      container: 'bg-emerald-50/90 border-emerald-200 text-emerald-950 shadow-sm backdrop-blur-md',
      icon: <ShieldIcon className="text-emerald-700 shrink-0" size={18} />,
      titleColor: 'text-emerald-950 font-bold',
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

