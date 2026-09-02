'use client';

import { Toast } from '@erametsad/ui';
import { Check, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(email)
      .then(() => {
        setCopied(true);
      })
      .catch(() => {
        setCopied(false);
      });
  }, [email]);

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-button border border-primary px-6 font-label font-semibold text-primary transition-all duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none md:w-auto"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        Kopeeri aadress
      </button>
      {copied && (
        <Toast message="Kopeeritud" type="success" isVisible onClose={() => { setCopied(false); }} />
      )}
    </>
  );
}
