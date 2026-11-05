import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * Bản sửa nhỏ so với scaffold: gộp className của nơi gọi vào thay vì ghi đè.
 * (Bản scaffold đặt className trước {...props} nên hễ truyền className — ví dụ
 * "btn-block btn-lg" ở màn auth — là mất luôn class .btn/.btn-primary.)
 */
export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className, children, ...props }) => {
  return (
    <button className={`btn btn-${variant} ${className ?? ''}`.trim()} {...props}>
      {children}
    </button>
  );
};