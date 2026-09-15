export const ARTICLE_AI_ENDPOINT = 'https://paldyn-article-ai.dev21mo-508.workers.dev';

export const MAX_ARTICLE_CONTEXT_CHARS = 7_000;
export const MAX_SELECTED_TEXT_CHARS = 4_000;
/* 붙여넣은 이미지. 워커가 인라인으로 실어 보내므로 여기서 미리 줄여 둔다. */
export const MAX_PASTED_IMAGES = 4;
export const MAX_PASTED_IMAGE_EDGE = 1_600;
export const MAX_PASTED_IMAGE_CHARS = 2_600_000;
export const PASTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_ARTICLE_ANSWER_CHARS = 60_000;
/** 지난 대화가 문서 발췌 자리를 다 빼앗지 않도록 이력에 쓸 수 있는 몫. */
export const MAX_CONVERSATION_CONTEXT_CHARS = 2_400;
export const MAX_CONVERSATION_ANSWER_CHARS = 700;
export const MAX_CONVERSATION_TURNS = 6;
const ARTICLE_SECTION_GAP = '\n\n[문서 발췌]\n';

const MAX_CONTEXT_BLOCKS = 8;
const MAX_BLOCK_CHARS = 1_600;

const STOP_WORDS = new Set([
  '관련',
  '내용',
  '대해',
  '무엇',
  '설명',
  '어떤',
  '알려줘',
  '알려주세요',
  '이것',
  '이해',
  '질문',
  '현재',
  '해줘',
  '해주세요',
]);

const PARTICLES = [
  '으로',
  '에서',
  '에게',
  '부터',
  '까지',
  '처럼',
  '보다',
  '인가요',
  '나요',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '와',
  '과',
  '로',
];

export interface ArticleContextBlock {
  text: string;
  heading?: string;
  kind?: 'heading' | 'body';
}

interface DomContextBlock extends ArticleContextBlock {
  element: HTMLElement;
}

export interface ArticleTextSelection {
  range: Range;
  selectedText: string;
  placement: {
    above: boolean;
    left: number;
    top: number;
  };
}

export type ArticlePanelPlacement = 'right' | 'sheet';

export interface ArticlePanelBounds {
  right: number;
}

export interface ArticlePanelGeometry {
  placement: ArticlePanelPlacement;
  left: number;
  width: number;
}

export interface ArticleMobileViewport {
  height: number;
  left: number;
  top: number;
  width: number;
}

const ARTICLE_PANEL_EDGE_INSET = 16;
const ARTICLE_PANEL_PROSE_GAP = 40;
const ARTICLE_PANEL_MIN_SIDE_WIDTH = 320;
const ARTICLE_PANEL_MAX_WIDTH = 384;
const ARTICLE_PANEL_SHEET_MAX_WIDTH = 640;
const ARTICLE_PANEL_SIDE_MIN_VIEWPORT = 768;
const ARTICLE_SELECTION_BUTTON_GAP = 12;
const ARTICLE_MOBILE_SHEET_HORIZONTAL_INSET = 12;
const ARTICLE_MOBILE_SHEET_TOP_INSET = 12;
const ARTICLE_MOBILE_SHEET_BOTTOM_INSET = 16;
const ARTICLE_MOBILE_KEYBOARD_BOTTOM_INSET = 20;

/** Keep the article fixed and use a side panel only when at least 320px remains. */
export function calculateArticlePanelGeometry(
  viewportWidth: number,
  proseBounds: ArticlePanelBounds | null,
): ArticlePanelGeometry {
  const sheet = (): ArticlePanelGeometry => ({
    placement: 'sheet',
    left: ARTICLE_PANEL_EDGE_INSET,
    width: Math.min(
      ARTICLE_PANEL_SHEET_MAX_WIDTH,
      Math.max(0, viewportWidth - ARTICLE_PANEL_EDGE_INSET * 2),
    ),
  });

  if (viewportWidth < ARTICLE_PANEL_SIDE_MIN_VIEWPORT || !proseBounds) return sheet();

  const rightLeft = Math.round(proseBounds.right + ARTICLE_PANEL_PROSE_GAP);
  const rightWidth = Math.floor(viewportWidth - ARTICLE_PANEL_EDGE_INSET - rightLeft);
  if (rightWidth >= ARTICLE_PANEL_MIN_SIDE_WIDTH) {
    const width = Math.min(ARTICLE_PANEL_MAX_WIDTH, rightWidth);
    return {
      placement: 'right',
      left: viewportWidth - ARTICLE_PANEL_EDGE_INSET - width,
      width,
    };
  }

  return sheet();
}

/** Place the compact mobile sheet inside the keyboard-adjusted visual viewport. */
export function calculateArticleMobileViewport(
  width: number,
  height: number,
  offsetLeft = 0,
  offsetTop = 0,
  keyboardOpen = false,
): ArticleMobileViewport {
  const viewportLeft = Math.max(0, offsetLeft);
  const viewportTop = Math.max(0, offsetTop);
  const viewportWidth = Math.max(0, width);
  const viewportHeight = Math.max(0, height);
  const bottomInset = keyboardOpen
    ? ARTICLE_MOBILE_KEYBOARD_BOTTOM_INSET
    : ARTICLE_MOBILE_SHEET_BOTTOM_INSET;
  const availableHeight = Math.max(
    0,
    viewportHeight - ARTICLE_MOBILE_SHEET_TOP_INSET - bottomInset,
  );
  const sheetHeight = Math.min(520, Math.max(320, viewportHeight * 0.6), availableHeight);

  return {
    height: Math.floor(sheetHeight),
    left: Math.ceil(viewportLeft + ARTICLE_MOBILE_SHEET_HORIZONTAL_INSET),
    top: Math.floor(viewportTop + viewportHeight - sheetHeight - bottomInset),
    width: Math.floor(
      Math.max(0, viewportWidth - ARTICLE_MOBILE_SHEET_HORIZONTAL_INSET * 2),
    ),
  };
}

export interface ArticleAskPayload {
  title: string;
  context: string;
  selectedText: string;
  question: string;
  /** 붙여넣은 이미지. 워커가 인라인 블록으로 모델에 넘긴다. */
  images?: { data: string; mimeType: string }[];
}

export interface ArticleAskResponse {
  answer: string;
  model: string;
}

/** 워커가 429와 함께 알려 주는 것. daily면 리셋 전까지 다시 시도해도 막힌다. */
export interface ArticleAskErrorDetail {
  message: string;
  scope: 'daily' | 'burst' | '';
  retryAfter: number;
}

export class ArticleAskHttpError extends Error {
  readonly status: number;
  readonly detail: ArticleAskErrorDetail;

  constructor(status: number, detail?: Partial<ArticleAskErrorDetail>) {
    super(`Article AI request failed with ${status}`);
    this.name = 'ArticleAskHttpError';
    this.status = status;
    this.detail = {
      message: detail?.message ?? '',
      scope: detail?.scope ?? '',
      retryAfter: detail?.retryAfter ?? 0,
    };
  }
}

export class ArticleAskResponseError extends Error {
  constructor() {
    super('Article AI returned an invalid response');
    this.name = 'ArticleAskResponseError';
  }
}

export function normalizeArticleText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Preserve newlines and indentation because they can carry meaning in selected code. */
export function normalizeSelectedArticleText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 2)).trimEnd()} …`;
}

function stemKoreanToken(token: string): string {
  for (const particle of PARTICLES) {
    if (token.endsWith(particle) && token.length - particle.length >= 2) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

export function articleQuestionTokens(value: string): string[] {
  const normalized = value.normalize('NFKC').toLocaleLowerCase('ko-KR');
  const matches = normalized.match(/[가-힣]{2,}|[a-z0-9][a-z0-9.+#/_-]*/g) ?? [];
  const tokens = matches
    .map((token) => (/^[가-힣]+$/.test(token) ? stemKoreanToken(token) : token))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  return [...new Set(tokens)].slice(0, 16);
}

function occurrenceCount(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;

  while (count < 4) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }

  return count;
}

function scoreBlock(block: ArticleContextBlock, tokens: readonly string[]): number {
  const text = block.text.normalize('NFKC').toLocaleLowerCase('ko-KR');
  const heading = (block.heading ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR');

  return tokens.reduce(
    (score, token) =>
      score + occurrenceCount(text, token) * 3 + occurrenceCount(heading, token) * 5,
    0,
  );
}

function excerptAround(value: string, tokens: readonly string[], selectedText = ''): string {
  if (value.length <= MAX_BLOCK_CHARS) return value;

  const lower = value.toLocaleLowerCase('ko-KR');
  const selectedNeedle = truncate(normalizeArticleText(selectedText), 180).toLocaleLowerCase('ko-KR');
  let hit = selectedNeedle ? lower.indexOf(selectedNeedle) : -1;

  if (hit < 0) {
    for (const token of tokens) {
      hit = lower.indexOf(token);
      if (hit >= 0) break;
    }
  }

  if (hit < 0) return truncate(value, MAX_BLOCK_CHARS);

  const start = Math.max(0, Math.min(hit - 420, value.length - MAX_BLOCK_CHARS));
  const end = Math.min(value.length, start + MAX_BLOCK_CHARS);
  return `${start > 0 ? '… ' : ''}${value.slice(start, end).trim()}${end < value.length ? ' …' : ''}`;
}

interface Candidate {
  index: number;
  priority: number;
}

function addCandidate(map: Map<number, number>, index: number, priority: number, length: number): void {
  if (index < 0 || index >= length) return;
  map.set(index, Math.max(priority, map.get(index) ?? Number.NEGATIVE_INFINITY));
}

function formatChosen(
  blocks: readonly ArticleContextBlock[],
  candidates: readonly Candidate[],
  tokens: readonly string[],
  selectedText: string,
  maxChars: number,
): string {
  const picked: Array<{ index: number; block: ArticleContextBlock; text: string }> = [];
  let estimated = 0;

  for (const candidate of [...candidates].sort(
    (a, b) => b.priority - a.priority || a.index - b.index,
  )) {
    if (picked.length >= MAX_CONTEXT_BLOCKS) break;
    const block = blocks[candidate.index];
    const text = excerptAround(block.text, tokens, selectedText);
    const overhead = (block.heading?.length ?? 0) + 16;
    if (picked.length > 0 && estimated + text.length + overhead > maxChars) continue;

    picked.push({ index: candidate.index, block, text });
    estimated += text.length + overhead;
  }

  if (picked.length === 0 && blocks.length > 0) {
    picked.push({
      index: 0,
      block: blocks[0],
      text: excerptAround(blocks[0].text, tokens, selectedText),
    });
  }

  picked.sort((a, b) => a.index - b.index);

  const parts: string[] = [];
  let lastIndex = -1;
  let lastHeading = '';

  for (const item of picked) {
    if (lastIndex >= 0 && item.index > lastIndex + 1) parts.push('[중간 내용 생략]');

    if (item.block.kind === 'heading') {
      parts.push(`## ${item.text}`);
      lastHeading = item.text;
    } else {
      const heading = item.block.heading ?? '';
      if (heading && heading !== lastHeading) {
        parts.push(`## ${heading}`);
        lastHeading = heading;
      }
      parts.push(item.text);
    }

    lastIndex = item.index;
  }

  return truncate(parts.join('\n\n'), maxChars);
}

/** Choose the best matching paragraphs and their neighbors, falling back to the reading position. */
export function selectRelevantArticleContext(
  blocks: readonly ArticleContextBlock[],
  question: string,
  focusIndex = 0,
  maxChars = MAX_ARTICLE_CONTEXT_CHARS,
): string {
  if (blocks.length === 0) return '';

  const tokens = articleQuestionTokens(question);
  const scored = blocks
    .map((block, index) => ({ index, score: scoreBlock(block, tokens) }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || Math.abs(a.index - focusIndex) - Math.abs(b.index - focusIndex),
    );

  const seeds =
    scored.length > 0
      ? scored.slice(0, 3)
      : [{ index: Math.max(0, Math.min(focusIndex, blocks.length - 1)), score: 1 }];
  const candidates = new Map<number, number>();

  for (const seed of seeds) {
    addCandidate(candidates, seed.index, seed.score * 100 + 30, blocks.length);
    addCandidate(candidates, seed.index - 1, seed.score * 100 + 20, blocks.length);
    addCandidate(candidates, seed.index + 1, seed.score * 100 + 20, blocks.length);
    addCandidate(candidates, seed.index - 2, seed.score * 100 + 10, blocks.length);
    addCandidate(candidates, seed.index + 2, seed.score * 100 + 10, blocks.length);
  }

  addCandidate(candidates, focusIndex, 1, blocks.length);

  return formatChosen(
    blocks,
    [...candidates].map(([index, priority]) => ({ index, priority })),
    tokens,
    '',
    maxChars,
  );
}

/** Build selection context from the touched blocks plus their immediate neighbors. */
export function selectSurroundingArticleContext(
  blocks: readonly ArticleContextBlock[],
  selectedIndices: readonly number[],
  selectedText: string,
  maxChars = MAX_ARTICLE_CONTEXT_CHARS,
): string {
  if (blocks.length === 0) return '';

  const touched = selectedIndices.length > 0 ? [...new Set(selectedIndices)] : [0];
  const candidates = new Map<number, number>();

  for (const index of touched) {
    addCandidate(candidates, index, 1_000, blocks.length);
    addCandidate(candidates, index - 1, 200, blocks.length);
    addCandidate(candidates, index + 1, 200, blocks.length);
    addCandidate(candidates, index - 2, 100, blocks.length);
    addCandidate(candidates, index + 2, 100, blocks.length);
  }

  return formatChosen(
    blocks,
    [...candidates].map(([index, priority]) => ({ index, priority })),
    articleQuestionTokens(selectedText),
    selectedText,
    maxChars,
  );
}

function articleBlockText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  // KaTeX renders the same formula as MathML, a TeX annotation, and visual HTML.
  // Keep one compact TeX representation so formulas do not consume the context
  // budget three times.
  for (const formula of clone.querySelectorAll<HTMLElement>('.katex')) {
    const annotation = formula.querySelector<HTMLElement>(
      'annotation[encoding="application/x-tex"]',
    );
    formula.replaceWith(document.createTextNode(annotation?.textContent?.trim() ?? ''));
  }

  for (const hidden of clone.querySelectorAll('script, style, [hidden], [aria-hidden="true"]')) {
    hidden.remove();
  }

  return normalizeArticleText(clone.textContent ?? '');
}

function collectDomBlocks(root: HTMLElement): DomContextBlock[] {
  const blocks: DomContextBlock[] = [];
  let heading = '';

  for (const child of root.children) {
    if (
      !(child instanceof HTMLElement) ||
      child.matches('script, style, [hidden], [aria-hidden="true"]')
    ) {
      continue;
    }

    const text = articleBlockText(child);
    if (!text) continue;

    const isHeading = /^H[2-4]$/.test(child.tagName);
    if (isHeading) heading = text;

    blocks.push({
      element: child,
      heading: isHeading ? undefined : heading,
      kind: isHeading ? 'heading' : 'body',
      text,
    });
  }

  return blocks;
}

function focusBlockIndex(blocks: readonly DomContextBlock[]): number {
  const viewportCenter = window.innerHeight * 0.48;
  let closest = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  blocks.forEach((block, index) => {
    const rect = block.element.getBoundingClientRect();
    const distance =
      rect.top <= viewportCenter && rect.bottom >= viewportCenter
        ? 0
        : Math.min(Math.abs(rect.top - viewportCenter), Math.abs(rect.bottom - viewportCenter));
    if (distance < closestDistance) {
      closest = index;
      closestDistance = distance;
    }
  });

  return closest;
}

export function buildArticleQuestionContext(
  root: HTMLElement | null,
  question: string,
  fallback = '',
): string {
  if (!root) return truncate(normalizeArticleText(fallback), MAX_ARTICLE_CONTEXT_CHARS);
  const blocks = collectDomBlocks(root);
  if (blocks.length === 0) {
    return truncate(normalizeArticleText(fallback), MAX_ARTICLE_CONTEXT_CHARS);
  }
  return selectRelevantArticleContext(blocks, question, focusBlockIndex(blocks));
}

/** 한 번 주고받은 질문과 답변. 다음 질문에 문맥으로 함께 보낸다. */
export interface ArticleConversationEntry {
  question: string;
  answer: string;
}

/**
 * 워커는 대화 이력을 받는 자리가 따로 없고 context 한 덩어리만 받는다. 그래서
 * 문서 발췌 앞에 지난 대화를 붙여 "이어지는 질문"을 이해하게 한다.
 *
 * 문서 발췌 자리를 다 빼앗기면 정작 근거가 사라지므로 이력은 전체 예산의
 * 일부까지만 쓰고, 긴 답변은 앞부분만 남긴다. 최신 대화부터 담다가 예산이
 * 차면 거기서 끊는다 — 방금 나눈 말이 가장 많이 쓰인다.
 */
export function buildArticleConversationContext(
  articleContext: string,
  history: readonly ArticleConversationEntry[],
): string {
  if (history.length === 0) return articleContext;

  const kept: string[] = [];
  let used = 0;

  for (const entry of history.slice(-MAX_CONVERSATION_TURNS).reverse()) {
    const question = normalizeArticleText(entry.question);
    const answer = truncate(normalizeArticleText(entry.answer), MAX_CONVERSATION_ANSWER_CHARS);
    if (!question || !answer) continue;

    const block = `Q. ${question}\nA. ${answer}`;
    if (used + block.length > MAX_CONVERSATION_CONTEXT_CHARS) break;
    used += block.length;
    kept.unshift(block);
  }

  if (kept.length === 0) return articleContext;

  const transcript = `[지난 대화]\n${kept.join('\n\n')}`;
  const room = MAX_ARTICLE_CONTEXT_CHARS - transcript.length - ARTICLE_SECTION_GAP.length;
  const body = truncate(articleContext, Math.max(0, room));

  return body ? `${transcript}${ARTICLE_SECTION_GAP}${body}` : transcript;
}

function selectionRect(range: Range): DOMRect | null {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  if (rects.length === 0) return null;

  const visible = rects.filter((rect) => rect.bottom >= 8 && rect.top <= window.innerHeight - 8);
  return visible[visible.length - 1] ?? rects[rects.length - 1];
}

/** Capture a real selection contained entirely within the article body. */
export function captureArticleTextSelection(
  root: HTMLElement,
  selection: Selection | null,
): ArticleTextSelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  if (!selection.anchorNode || !selection.focusNode) return null;
  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null;

  const selectedText = truncate(
    normalizeSelectedArticleText(selection.toString()),
    MAX_SELECTED_TEXT_CHARS,
  );
  if (selectedText.length < 2) return null;

  const range = selection.getRangeAt(0).cloneRange();
  const rect = selectionRect(range);
  if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return null;

  const halfButton = Math.min(86, Math.max(64, window.innerWidth / 4));
  const left = Math.min(
    window.innerWidth - halfButton,
    Math.max(halfButton, rect.left + rect.width / 2),
  );
  const above = rect.bottom + 48 > window.innerHeight;

  return {
    range,
    selectedText,
    placement: {
      above,
      left,
      top: above ? rect.top - ARTICLE_SELECTION_BUTTON_GAP : rect.bottom + ARTICLE_SELECTION_BUTTON_GAP,
    },
  };
}

export function buildArticleSelectionContext(
  root: HTMLElement,
  range: Range,
  selectedText: string,
): string {
  const blocks = collectDomBlocks(root);
  const selectedIndices: number[] = [];

  blocks.forEach((block, index) => {
    try {
      if (range.intersectsNode(block.element)) selectedIndices.push(index);
    } catch {
      // A DOM update can invalidate a stored Range; the selector has a safe fallback.
    }
  });

  return selectSurroundingArticleContext(blocks, selectedIndices, selectedText);
}

/** 패널에 붙어 있는 선택 하나. 문맥과 보여 줄 원문을 함께 들고 다닌다. */
export interface ArticleSelectionPiece {
  context: string;
  text: string;
}

/**
 * 여러 문장을 골라 붙였을 때 요청 한 건으로 합친다. 워커는 선택 본문도 문맥도
 * 한 덩어리씩만 받으므로 여기서 이어 붙인다.
 *
 * 둘 이상이면 번호를 매긴다 — 모델이 "첫 번째 문장"처럼 짚어 답할 수 있어야 한다.
 * 같은 문단에서 여러 문장을 고르면 문맥이 겹치므로 같은 덩어리는 한 번만 싣는다.
 */
export function combineArticleSelections(
  selections: readonly ArticleSelectionPiece[],
): { context: string; selectedText: string } {
  const texts = selections
    .map((piece) => normalizeSelectedArticleText(piece.text))
    .filter(Boolean);

  const selectedText = truncate(
    texts.length > 1
      ? texts.map((text, index) => `${index + 1}) ${text}`).join('\n\n')
      : (texts[0] ?? ''),
    MAX_SELECTED_TEXT_CHARS,
  );

  const seen = new Set<string>();
  const blocks: string[] = [];
  let used = 0;
  for (const piece of selections) {
    const context = piece.context.trim();
    if (!context || seen.has(context)) continue;
    seen.add(context);
    if (used + context.length > MAX_ARTICLE_CONTEXT_CHARS) break;
    used += context.length + 2;
    blocks.push(context);
  }

  return { context: truncate(blocks.join('\n\n'), MAX_ARTICLE_CONTEXT_CHARS), selectedText };
}

/** 붙여넣어 딸려 갈 이미지 한 장. data는 base64 본문만 담는다. */
export interface ArticleImageAttachment {
  data: string;
  mimeType: string;
  name: string;
  preview: string;
}

/** 붙여넣기·드롭에서 이미지 파일만 골라낸다. 스크린샷은 대개 png 한 장으로 온다. */
export function pickPastedImages(files: readonly File[]): File[] {
  return files.filter((file) => PASTED_IMAGE_TYPES.includes(file.type));
}

/** data URL 한 줄을 첨부 한 장으로 바꾼다. 규격을 벗어나면 버린다. */
export function readImageAttachment(
  dataUrl: string,
  name = '붙여넣은 이미지',
): ArticleImageAttachment | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const data = match[2];
  if (!PASTED_IMAGE_TYPES.includes(mimeType)) return null;
  if (!data || data.length > MAX_PASTED_IMAGE_CHARS) return null;

  return { data, mimeType, name, preview: dataUrl };
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 스크린샷을 그대로 실으면 몇 MB가 된다. 긴 변 기준으로 줄이고 jpeg로 다시 인코딩한다.
 * 애니메이션 gif는 첫 프레임만 남으므로 손대지 않고 원본을 쓴다.
 * 어느 단계든 실패하면 원본 data URL로 물러선다 — 줄이기는 거들 뿐이다.
 */
export async function prepareArticleImage(file: File): Promise<ArticleImageAttachment | null> {
  if (!PASTED_IMAGE_TYPES.includes(file.type)) return null;

  const name = file.name || '붙여넣은 이미지';
  if (file.type === 'image/gif') return readImageAttachment(await fileToDataUrl(file), name);

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PASTED_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return readImageAttachment(await fileToDataUrl(file), name);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return readImageAttachment(canvas.toDataURL('image/jpeg', 0.82), name);
  } catch {
    return readImageAttachment(await fileToDataUrl(file), name);
  } finally {
    bitmap?.close();
  }
}

export async function requestArticleAnswer(
  payload: ArticleAskPayload,
  signal?: AbortSignal,
): Promise<ArticleAskResponse> {
  const response = await fetch(ARTICLE_AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal,
  });

  if (!response.ok) {
    // 워커가 사람이 읽을 문구를 실어 보낸다. 상태 코드만으로 지어내지 말고 그것을 쓴다.
    let detail: Partial<ArticleAskErrorDetail> | undefined;
    try {
      const failure = (await response.json()) as {
        error?: unknown;
        scope?: unknown;
        retryAfter?: unknown;
      } | null;
      detail = {
        message: typeof failure?.error === 'string' ? failure.error : '',
        scope:
          failure?.scope === 'daily' || failure?.scope === 'burst' ? failure.scope : '',
        retryAfter: typeof failure?.retryAfter === 'number' ? failure.retryAfter : 0,
      };
    } catch {
      detail = undefined;
    }
    throw new ArticleAskHttpError(response.status, detail);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ArticleAskResponseError();
  }

  const answer = typeof (data as { answer?: unknown } | null)?.answer === 'string'
    ? (data as { answer: string }).answer.trim()
    : '';

  if (
    !data ||
    typeof data !== 'object' ||
    !answer ||
    answer.length > MAX_ARTICLE_ANSWER_CHARS
  ) {
    throw new ArticleAskResponseError();
  }

  const model =
    typeof (data as { model?: unknown }).model === 'string'
      ? (data as { model: string }).model
      : '';

  return { answer, model };
}

export function articleAskErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '답변이 조금 늦어지고 있어요. 잠시 후 다시 시도해 주세요.';
  }
  if (error instanceof ArticleAskHttpError) {
    // 워커가 보낸 문구가 있으면 그대로 쓴다 — 하루치를 다 썼는지, 잠깐 몰렸는지는
    // 거기서만 알 수 있고, 상태 코드만 보고 "잠시 후"라고 하면 거짓말이 된다.
    if (error.detail.message) return error.detail.message;
    if (error.status === 429) return '질문이 잠시 몰렸어요. 잠시 후 다시 시도해 주세요.';
    if (error.status >= 500) return 'AI가 잠시 응답하지 못했어요. 잠시 후 다시 시도해 주세요.';
    return '질문을 전송하지 못했어요. 내용을 확인한 뒤 다시 시도해 주세요.';
  }
  if (error instanceof ArticleAskResponseError) {
    return '답변을 읽지 못했어요. 다시 한 번 질문해 주세요.';
  }
  return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
}

/** 오늘 치를 다 쓴 경우. 다시 시도해도 리셋 전까지 막히므로 버튼을 감춘다. */
export function isArticleQuotaExhausted(error: unknown): boolean {
  return error instanceof ArticleAskHttpError && error.detail.scope === 'daily';
}
