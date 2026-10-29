export function matchesCloudLoadTestGrant(
  userId: string | null | undefined,
  grantedUserId: string | null | undefined,
) {
  return Boolean(userId && grantedUserId && userId === grantedUserId);
}
