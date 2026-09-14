export interface ArticleReadingBounds {
  top: number;
  height: number;
}

/** 본문 시작과 끝만 기준으로 0~1 사이의 읽기 진행률을 계산합니다. */
export function calculateArticleReadingProgress(
  bounds: ArticleReadingBounds,
  viewportHeight: number,
): number {
  const passed = -bounds.top;
  const span = bounds.height - viewportHeight;

  if (span <= 0) return passed > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, passed / span));
}
