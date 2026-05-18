---
title: "TypeScript ESLint — 타입 인식 린팅 완전 가이드"
description: "@typescript-eslint/parser와 eslint-plugin을 활용한 타입 인식 린팅, recommended vs strict 구성, no-floating-promises 등 핵심 규칙, tsconfig 연동 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "TypeScript", "ESLint", "typescript-eslint", "린팅", "타입안전성", "코드품질"]
featured: false
draft: false
---

[지난 글](/posts/lint-prettier-separation/)에서 Prettier와 ESLint의 역할을 분리하는 방법을 다뤘습니다. 이번에는 **TypeScript 코드를 위한 ESLint 설정**, 즉 `@typescript-eslint` 패키지 생태계를 깊이 살펴봅니다. 일반 ESLint 규칙은 TypeScript 타입 정보를 모릅니다. 예를 들어 `Promise`를 반환하는 함수를 `await` 없이 호출해도 기본 규칙은 침묵합니다. TypeScript ESLint는 TypeScript 컴파일러의 **타입 체커(Type Checker)**를 ESLint 규칙 안으로 끌어들여 이 공백을 메웁니다.

---

## 아키텍처 개요

![TypeScript ESLint 아키텍처](/assets/posts/lint-typescript-eslint-arch.svg)

TypeScript ESLint는 크게 두 패키지로 나뉩니다.

- **`@typescript-eslint/parser`** — ESLint가 `.ts`/`.tsx` 파일을 파싱할 수 있도록 TypeScript 컴파일러 API를 이용해 **TSESTree** 형식의 AST를 생성합니다. 선택적으로 TypeScript `Program` 객체(타입 정보 포함)도 넘겨줍니다.
- **`@typescript-eslint/eslint-plugin`** — TSESTree + 타입 정보를 활용하는 규칙 100개 이상을 제공합니다. 타입 정보를 요구하는 규칙은 `parserOptions.project`가 설정되어야 동작합니다.

`typescript-eslint` 패키지는 위 두 패키지를 묶어서 더 편리한 API(`tseslint.config()`)와 사전 구성된 config 객체를 제공합니다.

---

## 설치

```bash
# 최신 통합 패키지 (권장)
npm install -D typescript-eslint

# 또는 개별 패키지
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

TypeScript 자체와 ESLint 9+ 가 이미 설치되어 있어야 합니다.

```bash
npm install -D eslint typescript
```

---

## 기본 설정 (Flat Config)

```javascript
// eslint.config.mjs
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 타입 정보 없이 동작하는 기본 규칙
  ...tseslint.configs.recommended,
)
```

타입 인식 규칙까지 활성화하려면 `recommendedTypeChecked`를 쓰고 `parserOptions.project`를 설정합니다.

```javascript
// eslint.config.mjs
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
)
```

`project: true`는 각 파일에서 가장 가까운 `tsconfig.json`을 자동으로 찾습니다.

---

## 설정 단계와 강도

![typescript-eslint 설정 레시피](/assets/posts/lint-typescript-eslint-rules.svg)

| 프리셋 | 타입 정보 필요 | 설명 |
|---|---|---|
| `recommended` | ❌ | 기본 품질 규칙, CI 첫 도입에 적합 |
| `recommendedTypeChecked` | ✅ | 타입 인식 규칙 포함, 대부분의 프로젝트 권장 |
| `strict` | ✅ | `recommended` + 더 엄격한 규칙 |
| `strictTypeChecked` | ✅ | 가장 엄격한 세트 |
| `stylistic` | ❌ | 코드 스타일(일관성) 규칙 |
| `stylisticTypeChecked` | ✅ | 타입 인식 스타일 규칙 |

---

## 주요 타입 인식 규칙

### `@typescript-eslint/no-floating-promises`

`Promise`를 반환하는 함수 호출에서 `await` 또는 `.catch()`가 없으면 오류를 냅니다. 런타임에서 조용히 실패하는 비동기 코드의 가장 흔한 버그를 잡아냅니다.

```typescript
// 오류: fetchData()가 Promise를 반환하지만 await 없음
fetchData()

// 정상
await fetchData()
fetchData().catch(console.error)

// 결과를 쓰지 않는다는 명시적 표시
void fetchData()
```

### `@typescript-eslint/no-unsafe-assignment`

`any` 타입의 값을 다른 변수에 할당할 때 경고합니다. `any`가 코드베이스 전체로 전파되는 것을 막습니다.

```typescript
const data: any = getExternalData()
const name = data.name   // 오류: any 할당
const name2: string = data.name  // 오류: 여전히 any

// 해결: 런타임 검증 후 타입 단언
if (typeof data.name === 'string') {
  const name3 = data.name  // string으로 좁혀짐
}
```

### `@typescript-eslint/consistent-type-imports`

타입 전용 import에 `import type`을 강제합니다. 번들러 tree-shaking과 `isolatedModules` 모드에서 중요합니다.

```typescript
// 오류
import { User, createUser } from './user'

// 정상
import type { User } from './user'
import { createUser } from './user'

// 또는 인라인 type
import { type User, createUser } from './user'
```

### `@typescript-eslint/await-thenable`

`await` 뒤에 `Promise`가 아닌 값이 오면 경고합니다.

```typescript
const value = 42
await value   // 오류: number는 Thenable이 아님
```

---

## JS 파일 처리

TypeScript ESLint 규칙 중 일부는 `.js` 파일에서도 사용할 수 있습니다. `allowJs: true`가 `tsconfig.json`에 있으면 JS 파일도 타입 체킹 대상이 됩니다.

```javascript
// eslint.config.mjs
export default tseslint.config(
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // JS 파일은 타입 정보 없는 세트만 적용
    files: ['**/*.js', '**/*.mjs'],
    extends: [...tseslint.configs.recommended],
  },
)
```

---

## 성능: `parserOptions.project`의 비용

타입 인식 규칙은 TypeScript 컴파일러를 내부적으로 실행하므로 **린팅 속도가 크게 느려집니다**. 대형 모노레포에서는 `project`를 세분화하거나 `projectService` 옵션을 사용하는 것이 좋습니다.

```javascript
// 성능 최적화: projectService 사용 (v6+)
languageOptions: {
  parserOptions: {
    projectService: true,
    tsconfigRootDir: import.meta.dirname,
  },
}
```

`projectService`는 파일별로 필요한 tsconfig만 로드해 메모리와 시간을 줄입니다.

---

## 단계적 마이그레이션 전략

기존 JS 프로젝트를 TS로 마이그레이션하는 경우, 처음부터 `strict`를 적용하면 수백 개의 오류가 발생합니다. 단계적으로 올리는 것이 현실적입니다.

```javascript
// 1단계: warn으로 시작
rules: {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unsafe-assignment': 'warn',
}

// 2단계: 오류 수 줄인 후 error로 전환
rules: {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
}
```

---

## React + TypeScript 조합

```javascript
// eslint.config.mjs
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
    },
    settings: { react: { version: 'detect' } },
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
  },
)
```

---

**지난 글:** [Prettier와 ESLint 역할 분리 — 포맷터와 린터 공존](/posts/lint-prettier-separation/)

**다음 글:** [Husky + lint-staged — 커밋 훅으로 품질 게이트 구축](/posts/lint-husky-lintstaged/)

<br>
읽어주셔서 감사합니다. 😊
