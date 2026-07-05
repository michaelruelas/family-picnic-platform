'use client';

import { ReactNode } from 'react';
import { useBreatheIn } from '~/hooks/useBreatheIn';

interface BreatheSectionProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header' | 'main';
}

export function BreatheSection({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: BreatheSectionProps) {
  const [ref, isVisible] = useBreatheIn<HTMLElement>();

  return (
    <Tag
      ref={ref as unknown as React.RefObject<HTMLDivElement>}
      className={`breathe-in ${isVisible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: isVisible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}
