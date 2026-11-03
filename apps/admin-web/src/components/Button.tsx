import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block = false, loading = false, className, disabled, children, ...props },
  ref
) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'lg' && 'btn-lg',
    size === 'sm' && 'btn-sm',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});
