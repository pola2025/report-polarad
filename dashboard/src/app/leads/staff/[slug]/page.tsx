import { getNarattonStaffBySlug } from '@/lib/airtable-naratton-leads'
import { notFound } from 'next/navigation'
import { SlugPortalClient } from './client'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function StaffSlugPortalPage({ params }: Props) {
  const { slug } = await params

  // slug 유효성 체크 (영문+숫자만 허용)
  if (!/^[a-z0-9]+$/.test(slug)) {
    notFound()
  }

  const staff = await getNarattonStaffBySlug(slug)
  if (!staff) {
    notFound()
  }

  // telegram_chat_id가 있고 활성 상태면 로그인 가능
  const canLogin = !!staff.telegram_chat_id && staff.is_active
  const hasTelegram = !!staff.telegram_chat_id

  return (
    <SlugPortalClient
      slug={slug}
      staffName={staff.name}
      canLogin={canLogin}
      hasTelegram={hasTelegram}
    />
  )
}
