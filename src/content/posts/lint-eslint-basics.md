---
title: "ESLint 기초 — 파서·규칙·플러그인·Flat Config"
description: "ESLint의 파서·AST·규칙 실행 파이프라인, Flat Config(eslint.config.js) 설정 방식, 내장 규칙 vs 플러그인, autofix, TypeScript 통합, 커스텀 규칙 입문을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ESLint", "린트", "FlatConfig", "AST", "TypeScript", "플러그인", "코드품질"]
featured: false
draft: false
---

[지난 글](/posts/test-coverage-reliability/)에서 커버리지와 테스트 신뢰성을 살펴봤습니다. 이번부터는 **린팅과 포맷팅** 시리즈를 시작합니다. 첫 주제는 **ESLint**입니다. ESLint는 JavaScript/TypeScript 코드에서 잠재적 버그와 코드 품질 문제를 정적 분석으로 찾아내는 도구입니다. 2013년 Nicholas C. Zakas가 만들었고, 현재 대부분의 JavaScript 프로젝트에서 표준으로 사용됩니다.

---

## ESLint 처리 파이프라인

![ESLint 처리 파이프라인](/assets/posts/lint-eslint-basics-pipeline.svg)

ESLint는 소스 파일을 **파서(Parser)**로 AST(Abstract Syntax Tree)로 변환한 뒤, 각 규칙이 AST 노드를 방문하며 위반을 수집합니다. 기본 파서는 `espree`이며, TypeScript를 지원하려면 `@typescript-eslint/parser`로 교체합니다.

---

## 설치 및 초기화

```bash
# ESLint 9+ (Flat Config)
npm install -D eslint @eslint/js

# TypeScript 지원
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin typescript-eslint

# 초기화 마법사
npx eslint --init
```

```bash
# 실행 명령
npx eslint src/              # 디렉토리 검사
npx eslint src/ --fix        # 자동 수정
npx eslint src/ --ext .ts,.tsx  # 확장자 지정
```

---

## Flat Config — eslint.config.js (ESLint 9+ 기본)

ESLint 9에서 기존 `.eslintrc.*` 방식 대신 **Flat Config**가 기본이 되었습니다. JavaScript 파일 하나(`eslint.config.js`)에서 설정 객체 배열을 export하는 방식입니다.

```javascript
// eslint.config.js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import hooksPlugin from 'eslint-plugin-react-hooks'

export default [
  // 1. JS 권장 규칙
  js.configs.recommended,

  // 2. TypeScript 설정 (파일 글로브로 범위 지정)
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',  // 타입 정보 필요 규칙
      },
    },
  },

  // 3. React 설정
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': hooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    settings: { react: { version: 'detect' } },
  },

  // 4. 무시할 파일
  { ignores: ['dist/**', 'node_modules/**', '*.min.js'] },
]
```

Flat Config의 장점은 설정 파일이 단일 JavaScript 파일이어서 조건문, 함수, 동적 임포트를 활용할 수 있다는 점입니다.

---

## 규칙 설정과 옵션

![ESLint 규칙 카테고리와 설정 예시](/assets/posts/lint-eslint-basics-rules.svg)

```javascript
rules: {
  // 심각도만
  'no-console': 'warn',
  'no-debugger': 'error',

  // 옵션 포함 [심각도, 옵션]
  'eqeqeq': ['error', 'always', { null: 'ignore' }],
  'no-unused-vars': ['error', {
    vars: 'all',
    args: 'after-used',
    ignoreRestSiblings: true,
  }],

  // TypeScript 전용 규칙
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/prefer-nullish-coalescing': 'error',
  '@typescript-eslint/strict-null-checks': 'off',
}
```

---

## 인라인 비활성화

특정 라인이나 블록에서 규칙을 비활성화할 수 있습니다.

```typescript
// 한 줄 비활성화
const result = eval(userInput) // eslint-disable-line no-eval

// 다음 줄만 비활성화
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleLegacy(data: any) {}

// 블록 비활성화 (최소 범위로 제한할 것)
/* eslint-disable no-console */
console.log('디버그')
/* eslint-enable no-console */
```

`--report-unused-disable-directives` 플래그를 사용하면 더 이상 필요 없는 비활성화 주석을 경고합니다.

---

## TypeScript ESLint 통합

```bash
npm install -D typescript-eslint  # 통합 패키지 (권장)
```

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // 기본 TypeScript 규칙
  ...tseslint.configs.recommended,
  // 타입 정보를 사용하는 강화된 규칙
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 안전한 타입 체크 규칙
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  }
)
```

`recommendedTypeChecked`는 타입 정보를 필요로 하는 규칙을 포함합니다. `project: true`로 가장 가까운 `tsconfig.json`을 자동으로 찾습니다.

---

## 커스텀 규칙 입문

```javascript
// 예: console.log 대신 logger 사용을 강제하는 규칙
export const noConsoleLog = {
  meta: {
    type: 'suggestion',
    docs: { description: 'logger 모듈 사용을 권장합니다' },
    fixable: 'code',
    schema: [],
  },
  create(context) {
    return {
      'CallExpression[callee.object.name="console"][callee.property.name="log"]'(node) {
        context.report({
          node,
          message: 'console.log 대신 logger.info()를 사용하세요',
          fix(fixer) {
            return fixer.replaceText(node.callee.object, 'logger')
          },
        })
      },
    }
  },
}
```

커스텀 규칙은 AST 노드 선택자(CSS 선택자와 유사)로 특정 패턴을 탐지합니다. `astexplorer.net`에서 코드의 AST 구조를 시각적으로 탐색할 수 있습니다.

---

## CI 통합

```yaml
# .github/workflows/lint.yml
- name: Lint
  run: npx eslint . --max-warnings 0
  # --max-warnings 0: 경고도 CI 실패로 처리
```

`--max-warnings 0`으로 경고도 CI를 실패시키면, `warn`으로 설정한 규칙도 실질적으로 강제됩니다. 단계적 강화가 필요할 때는 임시로 숫자를 높였다가 낮춥니다.

---

**지난 글:** [커버리지와 테스트 신뢰성 — 숫자 너머의 품질](/posts/test-coverage-reliability/)

**다음 글:** [Prettier와 ESLint 역할 분리 — 포맷터와 린터 공존](/posts/lint-prettier-separation/)

<br>
읽어주셔서 감사합니다. 😊
