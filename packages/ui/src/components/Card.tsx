'use client';

import {
  type HTMLAttributes,
  type ReactNode,
  type ElementType,
} from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'content'> {
  image?: ReactNode;
  content?: ReactNode;
  actions?: ReactNode;
  hover?: boolean;
  as?: ElementType;
}

export function Card({
  image,
  content,
  actions,
  hover = true,
  as: Component = 'article',
  className = '',
  ...rest
}: CardProps) {
  const hoverClasses = hover
    ? 'transition-shadow duration-hover ease-hover shadow-card hover:shadow-card-hover motion-reduce:transition-none'
    : 'shadow-card';

  return (
    <Component
      className={`bg-bgPage rounded-card ${hoverClasses} ${className}`}
      {...rest}
    >
      {image && <div className="w-full">{image}</div>}
      {content && <div className="p-6">{content}</div>}
      {actions && (
        <div className="flex justify-end gap-2 px-6 pb-6">{actions}</div>
      )}
    </Component>
  );
}
