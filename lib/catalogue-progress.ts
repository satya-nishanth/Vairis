/** Resume at the next unseen flat media index. New users → 0. Fully finished → 0 (start fresh). */
export function getResumeFlatIndex(
  lastFrameIndex: number | null | undefined,
  totalMedia: number
): number {
  if (totalMedia <= 0) return 0
  if (lastFrameIndex == null || lastFrameIndex < 0) return 0
  // All media seen — loop back to the beginning instead of stuck on last item
  if (lastFrameIndex >= totalMedia - 1) return 0
  return lastFrameIndex + 1
}
