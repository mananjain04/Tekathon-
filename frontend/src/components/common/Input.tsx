import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  disabled,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative rounded-md shadow-sm">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          disabled={disabled}
          className={`block w-full rounded-md border bg-white/80 px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 transition-colors focus:outline-none focus:ring-1 focus:bg-white
            ${leftIcon ? 'pl-9' : ''} 
            ${rightIcon ? 'pr-9' : ''} 
            ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-zinc-300 focus:border-zinc-950 focus:ring-zinc-950/20'} 
            ${disabled ? 'opacity-50 cursor-not-allowed bg-zinc-100 text-zinc-400' : 'hover:border-zinc-400'} 
            ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {helperText && !error && <p className="text-xs text-zinc-500">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
