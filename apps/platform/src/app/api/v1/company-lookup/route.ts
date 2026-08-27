import { type NextRequest, NextResponse } from 'next/server'

import { lookupCompany } from '@/lib/company-lookup-fixtures'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const regCode = request.nextUrl.searchParams.get('regCode')

  if (!regCode) {
    return NextResponse.json({ error: 'regCode query parameter is required' }, { status: 400 })
  }

  const company = lookupCompany(regCode)

  if (!company) {
    return NextResponse.json({ found: false }, { status: 404 })
  }

  return NextResponse.json({
    found: true,
    company: {
      name: company.name,
      regCode: company.regCode,
      boardMembers: company.boardMembers,
    },
  })
}