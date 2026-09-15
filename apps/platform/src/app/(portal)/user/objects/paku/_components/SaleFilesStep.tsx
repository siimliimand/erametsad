'use client'

import { FormFile } from '@erametsad/ui'

import type { StepErrors } from './types'
import {
  SALE_FILE_ACCEPT,
  SALE_FILE_MAX_BYTES,
  SALE_FILE_MAX_COUNT,
} from './wizard-validation'

interface SaleFilesStepProps {
  errors: StepErrors
  onChange: (files: File[]) => void
}

export function SaleFilesStep({ errors, onChange }: SaleFilesStepProps) {
  return (
    <fieldset className="flex flex-col gap-md">
      <legend className="mb-2xs font-heading text-h3 font-semibold text-ink">
        Lisa failid
      </legend>
      <FormFile
        name="sale-files"
        accept={SALE_FILE_ACCEPT}
        maxSize={SALE_FILE_MAX_BYTES}
        multiple
        label={`Failid (valikuline, kuni ${String(SALE_FILE_MAX_COUNT)} faili)`}
        hint="Pildid ja PDF-failid, kuni 10 MB faili kohta"
        onChange={onChange}
        {...(errors.files ? { error: errors.files } : {})}
      />
    </fieldset>
  )
}
