'use client';

import { Quote } from 'lucide-react';

export interface TestimonialProps {
  quote: string;
  author: string;
  role?: string;
  image?: string;
}

export function Testimonial({ quote, author, role, image }: TestimonialProps) {
  return (
    <figure className="rounded-card bg-bgPage p-md shadow-card">
      <Quote className="mb-sm h-6 w-6 text-primary/30" aria-hidden="true" />
      <blockquote className="font-body text-body text-ink">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="mt-md flex items-center gap-3">
        {image && (
          <img
            src={image}
            alt={author}
            className="h-10 w-10 rounded-full object-cover"
          />
        )}
        <div>
          <span className="block font-heading text-bodySm text-ink">
            {author}
          </span>
          {role && (
            <span className="block font-body text-label text-inkMuted">
              {role}
            </span>
          )}
        </div>
      </figcaption>
    </figure>
  );
}