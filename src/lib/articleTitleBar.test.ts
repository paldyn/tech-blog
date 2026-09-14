import { describe, expect, it } from 'vitest';
import { calculateArticleReadingProgress } from './articleTitleBar';

describe('글 읽기 진행률', () => {
  it('본문에 도달하기 전에는 0이다', () => {
    expect(calculateArticleReadingProgress({ top: 320, height: 2_000 }, 800)).toBe(0);
  });

  it('문서 전체가 아니라 본문의 보이는 구간만 기준으로 계산한다', () => {
    expect(calculateArticleReadingProgress({ top: -600, height: 2_000 }, 800)).toBe(0.5);
  });

  it('본문 끝에 도달하면 1을 넘지 않는다', () => {
    expect(calculateArticleReadingProgress({ top: -2_000, height: 2_000 }, 800)).toBe(1);
  });

  it('한 화면보다 짧은 본문은 시작을 지나면 완료로 표시한다', () => {
    expect(calculateArticleReadingProgress({ top: -1, height: 500 }, 800)).toBe(1);
  });
});
