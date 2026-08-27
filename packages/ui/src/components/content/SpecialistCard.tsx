'use client';

import { type ReactNode } from 'react';
import { Card } from '../Card';

export interface SpecialistCardProps {
  name: string;
  role: string;
  phone?: string;
  email?: string;
  image?: string;
  mini?: boolean;
}

function FullCard({
  name,
  role,
  phone,
  email,
  image,
}: SpecialistCardProps) {
  const imageEl = image ? (
    <div className="aspect-[4/3] overflow-hidden rounded-card">
      <img
        src={image}
        alt={name}
        className="h-full w-full object-cover"
      />
    </div>
  ) : (
    <div className="flex aspect-[4/3] items-center justify-center rounded-card bg-bgMist">
      <span className="font-heading text-h4 text-inkMuted">
        {name.charAt(0)}
      </span>
    </div>
  );

  return (
    <Card image={imageEl}>
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-h4 text-ink">{name}</h3>
        <p className="font-body text-bodySm text-inkMuted">{role}</p>
        {(phone || email) && (
          <div className="mt-2 flex flex-col gap-1">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="font-body text-bodySm text-primary hover:text-primaryHover transition-colors duration-hover"
              >
                {phone}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="font-body text-bodySm text-primary hover:text-primaryHover transition-colors duration-hover"
              >
                {email}
              </a>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function MiniCard({
  name,
  role,
  phone,
  email,
  image,
}: SpecialistCardProps) {
  const avatar = image ? (
    <img
      src={image}
      alt={name}
      className="h-12 w-12 rounded-full object-cover shrink-0"
    />
  ) : (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bgMist">
      <span className="font-heading text-h4 text-inkMuted">
        {name.charAt(0)}
      </span>
    </div>
  );

  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-heading text-bodySm text-ink truncate">
          {name}
        </span>
        <span className="font-body text-label text-inkMuted truncate">
          {role}
        </span>
        {(phone || email) && (
          <div className="flex gap-2 mt-0.5">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="font-body text-label text-primary hover:text-primaryHover transition-colors duration-hover"
              >
                {phone}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="font-body text-label text-primary hover:text-primaryHover transition-colors duration-hover"
              >
                {email}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SpecialistCard(props: SpecialistCardProps) {
  if (props.mini) {
    return <MiniCard {...props} />;
  }
  return <FullCard {...props} />;
}