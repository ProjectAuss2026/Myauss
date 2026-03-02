import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  onClick,
  type = 'button',
  className = '',
}: ButtonProps) {
  const baseStyles = 'px-8 py-4 transition-all duration-200 cursor-pointer inline-block';
  const variantStyles = {
    primary:
      'bg-[#F97316] text-white hover:bg-[#EA580C] hover:shadow-[0_4px_12px_rgba(249,115,22,0.4)] hover:-translate-y-0.5',
    secondary: 'border-2 border-white/80 text-white hover:bg-white/10',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{ borderRadius: 'var(--button-radius)' }}
    >
      {children}
    </button>
  );
}
