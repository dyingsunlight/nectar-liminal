import { createHash } from 'node:crypto'
import type { UpdateUserProfileInput, UserProfile } from '@nectar/shared'

export function makePublicUserId(openId: string): string {
  return `usr_${createHash('sha256').update(openId).digest('hex').slice(0, 12)}`
}

export function deriveAvatarText(nickname: string): string {
  return Array.from(nickname.trim())[0] || '素'
}

export function createDefaultUser(openId: string, nowIso: string): UserProfile {
  const trimmed = openId.trim()
  const nickname = trimmed.length >= 4 ? `素物友_${trimmed.slice(-4)}` : '素物友'

  return {
    id: makePublicUserId(trimmed),
    nickname,
    memberLevel: '素物会员',
    avatarText: '素',
    avatarUrl: '',
    stats: {
      unpaid: 0,
      unshipped: 0,
      shipped: 0,
      afterSale: 0,
    },
    points: 0,
    couponCount: 0,
    createdAt: nowIso,
    lastLoginAt: nowIso,
  }
}

export function normalizeUserProfile(
  openId: string,
  raw: Partial<UserProfile>,
  nowIso: string
): UserProfile {
  const fallback = createDefaultUser(openId, nowIso)
  const nickname =
    typeof raw.nickname === 'string' && raw.nickname.trim()
      ? raw.nickname.trim()
      : fallback.nickname
  const avatarText =
    typeof raw.avatarText === 'string' && raw.avatarText.trim()
      ? raw.avatarText.trim()
      : deriveAvatarText(nickname)

  const rawStats = raw.stats
  const toNonNegativeInt = (val: unknown): number =>
    typeof val === 'number' && Number.isFinite(val) && val >= 0 ? Math.trunc(val) : 0

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : fallback.id,
    nickname,
    memberLevel:
      typeof raw.memberLevel === 'string' && raw.memberLevel.trim()
        ? raw.memberLevel.trim()
        : fallback.memberLevel,
    avatarText,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : '',
    stats: {
      unpaid: toNonNegativeInt(rawStats?.unpaid),
      unshipped: toNonNegativeInt(rawStats?.unshipped),
      shipped: toNonNegativeInt(rawStats?.shipped),
      afterSale: toNonNegativeInt(rawStats?.afterSale),
    },
    points: toNonNegativeInt(raw.points),
    couponCount: toNonNegativeInt(raw.couponCount),
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim()
        ? raw.createdAt.trim()
        : nowIso,
    lastLoginAt:
      typeof raw.lastLoginAt === 'string' && raw.lastLoginAt.trim()
        ? raw.lastLoginAt.trim()
        : nowIso,
  }
}

export function applyUserProfileUpdate(
  openId: string,
  existing: Partial<UserProfile>,
  input: UpdateUserProfileInput,
  nowIso: string
): UserProfile {
  const base = normalizeUserProfile(openId, existing, nowIso)
  const nextNickname =
    input.nickname !== undefined ? input.nickname.trim() : base.nickname
  return {
    ...base,
    nickname: nextNickname,
    avatarText:
      input.nickname !== undefined
        ? deriveAvatarText(nextNickname)
        : base.avatarText,
    avatarUrl:
      input.avatarUrl !== undefined ? input.avatarUrl.trim() : base.avatarUrl,
  }
}
