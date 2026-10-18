/** The active capsule uses the rendered navigation order, which may differ
 * from the order in which a user selected shortcuts. */
export function getMobileNavigationSlot(
  pathname: string,
  renderedPaths: readonly string[],
  moreOpen: boolean,
): number {
  if (moreOpen) return 4;
  const activeIndex = renderedPaths.indexOf(pathname);
  return activeIndex < 0 ? 4 : activeIndex;
}
