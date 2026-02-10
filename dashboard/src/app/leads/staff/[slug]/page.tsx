import { getNarattonStaffBySlug } from '@/lib/airtable-naratton-leads'
import { notFound } from 'next/navigation'
import { SlugPortalClient } from './client'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function StaffSlugPortalPage({ params }: Props) {
  const { slug } = await params

  if (!/^[a-z0-9]+$/.test(slug)) {
    notFound()
  }

  const staff = await getNarattonStaffBySlug(slug)
  if (!staff) {
    notFound()
  }

  return (
    <SlugPortalClient
      slug={slug}
      staffName={staff.name}
      isActive={staff.is_active}
      hasEmail={!!staff.email}
      hasTelegram={!!staff.telegram_chat_id}
    />
  )
}
