'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ObjectWizard } from './ObjectWizard'
import { GENERIC_ERROR, submitWizard, WizardSubmitError } from './submit'
import type { ContactPrefill, ObjectWizardData } from './types'

interface ObjectWizardSubmitterProps {
  contactPrefill: ContactPrefill
}

/** Thin onSubmit adapter: owns submitting/error state and the success redirect. */
export function ObjectWizardSubmitter({ contactPrefill }: ObjectWizardSubmitterProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit(data: ObjectWizardData): Promise<void> {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitWizard(data, {
        fetchImpl: fetch,
        redirect: (href) => {
          router.push(href)
        },
      })
    } catch (error) {
      setSubmitError(error instanceof WizardSubmitError ? error.message : GENERIC_ERROR)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ObjectWizard
      contactPrefill={contactPrefill}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
    />
  )
}
