---
title: "TypeScript 점진적 도입 — JS 프로젝트에서 TS로"
description: "기존 JavaScript 코드베이스에 TypeScript를 점진적으로 도입하는 전략, allowJs·checkJs 설정, JSDoc 타입 주석, ts-migrate 자동화, CI 통합까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "마이그레이션", "점진적도입", "allowJs", "JSDoc", "ts-migrate", "설정"]
featured: false
draft: false
---

[지난 글](/posts/ts-tsconfig-options/)에서 `tsconfig.json`의 주요 옵션을 정리했다. TypeScript 시리즈의 마지막 주제로, **기존 JavaScript 프로젝트에 TypeScript를 점진적으로 도입하는 전략**을 살펴본다. 처음부터 완전한 타입 안전성을 목표로 하면 방대한 코드베이스에서 팀 전체의 생산성이 일시에 떨어질 수 있다. 단계적 접근이 훨씬 현실적이다.

## 점진적 도입의 원칙

TypeScript 팀이 권장하는 마이그레이션의 원칙은 세 가지다.

1. **빌드를 깨지 않는다** — 각 단계에서 기존 기능이 그대로 동작해야 한다
2. **작은 단위로 자주** — 파일 단위, 모듈 단위로 전환
3. **엄격함을 점진적으로** — `strict: false`에서 시작해 단계적으로 높인다

## Phase 1 — JS 그대로, 타입 검사만 추가

`.js` 파일을 변환하지 않고 타입 검사의 혜택을 받을 수 있다.

```json
{
  "compilerOptions": {
    "allowJs": true,     // JS 파일 포함
    "checkJs": true,     // JS 파일도 타입 검사
    "strict": false,     // 처음엔 느슨하게
    "noEmit": true       // 출력 없이 검사만
  },
  "include": ["src"]
}
```

`checkJs: true`만으로도 명백한 타입 오류를 잡아낸다. IDE 자동 완성 품질도 크게 향상된다.

![점진적 도입 전략](/assets/posts/ts-incremental-adoption-strategy.svg)

## JSDoc으로 JS 파일 타입 지정

`.js` 파일을 변환하지 않고 JSDoc 주석으로 타입 정보를 추가할 수 있다.

```javascript
// @ts-check
/** @param {string} name @returns {string} */
function greet(name) {
  return `Hello, ${name}!`;
}

/** @type {import('./types').UserConfig} */
const config = loadConfig();

/**
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => boolean} predicate
 * @returns {T[]}
 */
function filter(arr, predicate) {
  return arr.filter(predicate);
}
```

JSDoc 방식은 외부 라이브러리 타입(`import('./types')`)도 참조할 수 있어, 전환 기간에 `.ts` 파일과 `.js` 파일이 공존하는 환경에서 매우 유용하다.

## Phase 2 — 새 파일부터 .ts 작성

새로 추가하는 파일은 모두 `.ts`로 작성하고, 기존 파일은 점진적으로 전환한다.

```typescript
// 기존 JS 모듈을 가져올 때 타입 선언 파일 추가
// legacy-module.d.ts
declare module "./legacy-module" {
  export function doSomething(input: string): number;
}
```

전환 우선순위는 **자주 변경되는 파일** → **여러 곳에서 가져오는 공통 유틸** → **비즈니스 로직 핵심 모듈** 순으로 잡는다.

## 자동 변환 도구

```bash
# ts-migrate: JS → TS 변환 + @ts-ignore 자동 삽입
npx ts-migrate migrate ./src

# 이후 @ts-ignore를 하나씩 제거하며 타입 추가
grep -r "@ts-ignore" src/ | wc -l  # 남은 수 추적
```

`ts-migrate`는 완벽한 타입을 만들지 않고, 우선 컴파일이 통과하는 상태를 만든다. 이후 `@ts-ignore`와 `any`를 하나씩 제거하며 품질을 높인다.

![마이그레이션 패턴](/assets/posts/ts-incremental-adoption-migration.svg)

## 오류 억제 주석

```typescript
// @ts-ignore: 임시 억제 (이유를 반드시 설명)
// @ts-ignore: TODO 레거시 API 제거 후 삭제 예정
legacyApi.call(wrongType);

// @ts-expect-error: 오류가 없어지면 경고 (권장)
// @ts-expect-error: 라이브러리 타입 오류, v3에서 수정 예정
someLib.undeclaredMethod();

// @ts-nocheck: 파일 전체 무시 (최후 수단)
```

`@ts-expect-error`는 오류가 사라지면 TS 컴파일러가 경고하므로, 임시 억제 후 잊어버리는 것을 방지한다.

## Phase 3 — strict 완전 적용

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "allowJs": false
  }
}
```

`strict: true`로 전환할 때 발생하는 오류 유형별 처리 방법이다.

| 오류 유형 | 처리 방법 |
|---|---|
| 암묵적 `any` | 타입 명시 또는 제네릭 추가 |
| `null` 가능성 | 타입 가드 또는 `!` 단언 (검증 후) |
| 함수 반환 타입 누락 | 명시적 반환 타입 추가 |
| 클래스 속성 미초기화 | 생성자 초기화 또는 `declare` |

## CI 통합

```bash
# package.json
"type-check": "tsc --noEmit"
```

```yaml
# GitHub Actions
- name: Type check
  run: npm run type-check
```

타입 검사를 CI에 포함하면 오류가 main 브랜치에 병합되는 것을 방지한다. `--noEmit`으로 파일을 생성하지 않고 검사만 실행한다.

## 팀 도입 시 고려사항

- **점진적 strict**: `tsconfig.strict-pending.json`에 strict 옵션을 넣고, 준비된 파일부터 적용
- **ESLint와 협력**: `@typescript-eslint/no-explicit-any` 규칙으로 `any` 추가를 제한
- **타입 커버리지 추적**: `npx type-coverage` 도구로 타입이 지정된 비율을 측정
- **새 팀원 온보딩**: TypeScript 완전 전환 후 JS 경험만 있는 개발자도 빠르게 적응

TypeScript 도입은 한번에 완성하는 것이 아니라 지속적으로 품질을 높이는 과정이다. 이것으로 JavaScript 완전 정복 시리즈의 TypeScript 섹션을 마무리한다. 다음 시리즈에서는 빌드 도구(Babel, SWC, webpack, Vite)를 깊이 살펴본다.

---

**지난 글:** [tsconfig 완전 정복 — 컴파일러 옵션 가이드](/posts/ts-tsconfig-options/)

<br>
읽어주셔서 감사합니다. 😊
