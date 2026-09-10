'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'

import { useAdminBase } from './AdminBase'

import { joinAdminBase } from '@/lib/routing/admin-base'


type AdminLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string }

/**
 * Base-relative admin link: href carries the path without the /admin
 * prefix (/auctions, /users/42) and is joined with the host's admin base
 * by the layout provider. Use this instead of next/link for every link
 * inside the (admin) tree so URLs stay prefix-free on the admin host.
 */
export function AdminLink({ href, ...rest }: AdminLinkProps) {
  const base = useAdminBase()
  return <Link href={joinAdminBase(base, href)} {...rest} />
}
