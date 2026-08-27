'use client';

import { SpecialistCard } from './SpecialistCard';

export interface ContactBandContact {
  name: string;
  role: string;
  phone?: string;
  email?: string;
  image?: string;
}

export interface ContactBandProps {
  title: string;
  description?: string;
  contacts: ContactBandContact[];
}

export function ContactBand({ title, description, contacts }: ContactBandProps) {
  return (
    <section className="bg-bgMist py-xl">
      <div className="mx-auto max-w-container-xl px-gutter">
        <div className="mb-lg">
          <h2 className="font-heading text-h2 text-ink">{title}</h2>
          {description && (
            <p className="mt-sm font-body text-body text-inkMuted max-w-container-sm">
              {description}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {contacts.map((contact, i) => (
            <SpecialistCard key={i} {...contact} mini />
          ))}
        </div>
      </div>
    </section>
  );
}