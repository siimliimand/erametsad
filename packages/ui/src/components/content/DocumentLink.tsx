'use client';

import { FileText } from 'lucide-react';

export interface DocumentLinkProps {
  title: string;
  href: string;
  fileSize?: string;
  format?: string;
}

export function DocumentLink({
  title,
  href,
  fileSize,
  format,
}: DocumentLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-card border border-border bg-bgPage p-4 transition-shadow duration-hover hover:shadow-card-hover"
    >
      <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="font-heading text-bodySm text-ink group-hover:text-primary transition-colors duration-hover truncate">
          {title}
        </span>
        {(format || fileSize) && (
          <span className="font-body text-label text-inkMuted">
            {[format, fileSize].filter(Boolean).join(' \u00b7 ')}
          </span>
        )}
      </div>
    </a>
  );
}