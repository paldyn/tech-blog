import { describe, expect, it } from 'vitest';
import { renderAiMarkdown } from './aiMarkdown';

describe('AI 답변 Markdown', () => {
  it('기본 Markdown과 GFM 표를 렌더한다', () => {
    const html = renderAiMarkdown(
      '## 요점\n\n- **첫째**\n\n| A | B |\n| - | - |\n| 1 | 2 |',
    );

    expect(html).toContain('<h2>요점</h2>');
    expect(html).toContain('<strong>첫째</strong>');
    expect(html).toContain('<table>');
  });

  it('raw HTML, 미허용 태그와 이벤트 속성을 제거한다', () => {
    const html = renderAiMarkdown(
      '<script>alert(1)</script><style>body{display:none}</style>' +
        '<img src="https://tracker.example/pixel" onerror="alert(2)">' +
        '<svg onload="alert(3)"></svg><iframe src="https://example.com"></iframe>',
    );

    expect(html).not.toMatch(/<(?:script|style|img|svg|iframe)/i);
    expect(html).not.toMatch(/on(?:error|load)=/i);
    expect(html).not.toContain('tracker.example');
  });

  it('대소문자와 data URL을 포함한 실행 가능한 링크를 제거한다', () => {
    const html = renderAiMarkdown(
      '[스크립트](JaVaScRiPt:alert(1)) [데이터](data:text/html;base64,PHNjcmlwdD4=)',
    );

    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/data:/i);
    expect(html).not.toContain('href=');
  });

  it('검증된 링크에 새 탭 보호 속성을 붙인다', () => {
    const html = renderAiMarkdown('[공식 문서](https://example.com/docs)');

    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toMatch(/rel="(?:noopener noreferrer|noreferrer noopener)"/);
  });

  it('GFM 체크박스를 비활성화해 상호작용 가능한 입력을 만들지 않는다', () => {
    const html = renderAiMarkdown('- [x] 완료');

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled');
    expect(html).toContain('checked');
  });
});
