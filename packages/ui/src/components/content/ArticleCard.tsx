'use client';

import { Card } from '../Card';

export interface ArticleCardProps {
  title: string;
  excerpt: string;
  image?: string;
  date: string;
  href: string;
  category?: string;
}

export function ArticleCard({
  title,
  excerpt,
  image,
  date,
  href,
  category,
}: ArticleCardProps) {
  const imageEl = image ? (
    <div className="aspect-[16/9] overflow-hidden rounded-card">
      <img
        src={image}
        alt={title}
        className="h-full w-full object-cover transition-transform duration-hover group-hover:scale-105"
      />
    </div>
  ) : undefined;

  const contentEl = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {category && (
          <span className="inline-block rounded-full bg-primaryLight px-2.5 py-0.5 font-body text-label text-primary">
            {category}
          </span>
        )}
        <time className="font-body text-label text-inkMuted">{date}</time>
      </div>
      <h3 className="font-heading text-h4 text-ink">{title}</h3>
      <p className="line-clamp-2 font-body text-body text-inkMuted">
        {excerpt}
      </p>
    </div>
  );

  return (
    <a href={href} className="group block">
      <Card image={imageEl} content={contentEl} hover />
    </a>
  );
}