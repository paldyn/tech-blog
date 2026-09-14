import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARTICLE_AI_ENDPOINT,
  ArticleAskHttpError,
  ArticleAskResponseError,
  articleAskErrorMessage,
  articleQuestionTokens,
  calculateArticleMobileViewport,
  calculateArticlePanelGeometry,
  MAX_ARTICLE_ANSWER_CHARS,
  MAX_ARTICLE_CONTEXT_CHARS,
  normalizeArticleText,
  normalizeSelectedArticleText,
  requestArticleAnswer,
  selectRelevantArticleContext,
  selectSurroundingArticleContext,
  type ArticleContextBlock,
} from './articleAsk';

afterEach(() => {
  vi.unstubAllGlobals();
});

const blocks: ArticleContextBlock[] = [
  { text: '이 글은 검색 증강 생성의 전체 흐름을 설명합니다.', kind: 'body' },
  { text: '청킹 전략', kind: 'heading' },
  {
    text: '문서는 의미 단위로 나누고 각 조각에 충분한 문맥을 남깁니다.',
    heading: '청킹 전략',
    kind: 'body',
  },
  {
    text: '임베딩 모델은 문장과 질의를 같은 벡터 공간에 놓습니다.',
    heading: '임베딩',
    kind: 'body',
  },
  { text: '재순위화', kind: 'heading' },
  {
    text: '리랭커는 검색 후보를 질문과의 관련도 순으로 다시 정렬합니다.',
    heading: '재순위화',
    kind: 'body',
  },
  { text: '평가에서는 recall과 정답 근거 포함률을 함께 봅니다.', heading: '평가', kind: 'body' },
];

describe('글 질문 패널 배치', () => {
  it('넓은 화면에서는 384px을 최대 폭으로 쓴다', () => {
    expect(
      calculateArticlePanelGeometry(2_048, {
        right: 1_530,
      }),
    ).toEqual({ placement: 'right', left: 1_648, width: 384 });
  });

  it('오른쪽이 좁으면 왼쪽 여백 대신 하단 시트를 사용한다', () => {
    expect(
      calculateArticlePanelGeometry(1_416, {
        right: 1_222,
      }),
    ).toEqual({ placement: 'sheet', left: 16, width: 640 });
  });

  it('목차가 있는 넓은 화면에서도 목차 바깥 오른쪽에 배치한다', () => {
    expect(
      calculateArticlePanelGeometry(1_920, { right: 1_477 }),
    ).toEqual({ placement: 'right', left: 1_520, width: 384 });
  });

  it('왼쪽 여백이 넓어도 오른쪽이 좁으면 왼쪽으로 전환하지 않는다', () => {
    expect(
      calculateArticlePanelGeometry(1_920, {
        right: 1_600,
      }),
    ).toEqual({ placement: 'sheet', left: 16, width: 640 });
  });

  it('1280px급 화면에서 오른쪽 320px이 안 남으면 시트를 사용한다', () => {
    expect(
      calculateArticlePanelGeometry(1_280, {
        right: 1_146.5,
      }),
    ).toEqual({ placement: 'sheet', left: 16, width: 640 });
  });

  it('390×844의 visual viewport 안에 12px 여백과 60% 높이를 유지한다', () => {
    expect(calculateArticleMobileViewport(390, 844)).toEqual({
      height: 506,
      left: 12,
      top: 321,
      width: 366,
    });
  });

  it('키보드가 올라온 390×500에서는 하단 20px을 남긴다', () => {
    expect(calculateArticleMobileViewport(390, 500, 0, 24, true)).toEqual({
      height: 320,
      left: 12,
      top: 184,
      width: 366,
    });
  });

  it('가용 높이가 320px보다 작으면 화면을 넘지 않는다', () => {
    expect(calculateArticleMobileViewport(390, 300).height).toBe(272);
  });
});

describe('글 질문 context', () => {
  it('질문 단어가 들어간 문단과 주변 문맥을 우선한다', () => {
    const context = selectRelevantArticleContext(blocks, '리랭커는 왜 필요한가요?', 0);
    expect(context).toContain('리랭커는 검색 후보');
    expect(context).toContain('재순위화');
  });

  it('뚜렷한 검색어가 없으면 현재 읽는 자리 주변을 쓴다', () => {
    expect(selectRelevantArticleContext(blocks, '이 부분을 쉽게 풀어줘', 3)).toContain(
      '임베딩 모델',
    );
  });

  it('선택한 문단과 바로 앞뒤 문단을 포함한다', () => {
    const context = selectSurroundingArticleContext(blocks, [3], blocks[3].text);
    expect(context).toContain('문서는 의미 단위');
    expect(context).toContain('임베딩 모델');
    expect(context).toContain('재순위화');
  });

  it('context 상한을 넘지 않는다', () => {
    const longBlocks = Array.from({ length: 20 }, (_, index) => ({
      text: `토큰 ${index} ${'아주 긴 문장 '.repeat(500)}`,
      kind: 'body' as const,
    }));
    expect(selectRelevantArticleContext(longBlocks, '토큰', 10).length).toBeLessThanOrEqual(
      MAX_ARTICLE_CONTEXT_CHARS,
    );
  });
});

describe('질문 텍스트 정리', () => {
  it('공백을 한 칸으로 줄인다', () => {
    expect(normalizeArticleText(' 앞줄\n\n  뒷줄 ')).toBe('앞줄 뒷줄');
  });

  it('선택한 코드의 줄바꿈과 들여쓰기는 보존한다', () => {
    expect(normalizeSelectedArticleText('  if (ok) {\n    run();\n  }  ')).toBe(
      'if (ok) {\n    run();\n  }',
    );
  });

  it('조사와 흔한 요청어를 걷어 관련 단어를 남긴다', () => {
    expect(articleQuestionTokens('리랭커가 왜 필요한지 설명해주세요')).toContain('리랭커');
  });
});

describe('글 질문 API', () => {
  it('문서화된 JSON 형식으로 지정 Worker만 호출한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: '**답변**', model: 'gemini-3.6-flash' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const payload = { title: '제목', context: '관련 문단', selectedText: '', question: '질문' };

    await expect(requestArticleAnswer(payload)).resolves.toEqual({
      answer: '**답변**',
      model: 'gemini-3.6-flash',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      ARTICLE_AI_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });

  it('형식이 잘못되거나 지나치게 큰 응답을 화면에 넘기지 않는다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ model: 'gemini' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'a'.repeat(MAX_ARTICLE_ANSWER_CHARS + 1) }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const payload = { title: '제목', context: '문맥', selectedText: '', question: '질문' };

    await expect(requestArticleAnswer(payload)).rejects.toBeInstanceOf(ArticleAskResponseError);
    await expect(requestArticleAnswer(payload)).rejects.toBeInstanceOf(ArticleAskResponseError);
  });

  it('상태에 맞는 자연스러운 오류 문구를 고른다', () => {
    expect(articleAskErrorMessage(new ArticleAskHttpError(429))).toContain('질문이 잠시 몰렸어요');
    expect(articleAskErrorMessage(new ArticleAskHttpError(503))).toContain(
      'AI가 잠시 응답하지 못했어요',
    );
    expect(articleAskErrorMessage(new TypeError('offline'))).toContain('네트워크 연결');
    expect(articleAskErrorMessage(new DOMException('timed out', 'AbortError'))).toContain(
      '답변이 조금 늦어지고 있어요',
    );
  });
});
