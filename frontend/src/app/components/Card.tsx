import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = true }: CardProps) {
  const hoverStyles = hover
    ? 'hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.15)]'
    : '';

  return (
    <div
      className={`bg-[#171717] p-6 transition-all duration-300 ${hoverStyles} ${className}`}
      style={{
        borderRadius: 'var(--card-radius)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {children}
    </div>
  );
}
