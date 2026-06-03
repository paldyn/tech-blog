---
title: "에디터 설정: VS Code로 TypeScript 개발 환경 완성"
description: "TypeScript 개발에 최적화된 VS Code 설정, 필수 확장, 키보드 단축키, 그리고 다른 에디터 옵션을 상세히 안내한다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "VSCode", "에디터설정", "IntelliSense", "개발환경", "확장"]
featured: false
draft: false
---

[지난 글](/posts/ts-first-program/)에서 첫 TypeScript 프로그램을 작성했다. 이번 편에서는 TypeScript 개발 경험을 극대화하는 에디터 환경을 구성한다. VS Code를 중심으로 핵심 기능과 설정을 다룬다.

## 왜 VS Code인가

TypeScript 팀이 직접 VS Code를 일상적인 개발 도구로 사용한다. TypeScript Language Server(`tsserver`)가 VS Code에 기본 내장되어 별도 플러그인 없이 최고 수준의 TypeScript 지원을 제공한다.

![VS Code + TypeScript: 최적의 조합](/assets/posts/ts-editor-setup-vscode.svg)

## TypeScript Language Server

VS Code가 TypeScript를 지원하는 핵심은 **tsserver**라는 언어 서버다. 이 서버가 백그라운드에서 다음 작업을 처리한다.

- 코드를 실시간으로 파싱하고 타입 분석
- 자동완성 후보 계산
- 타입 에러 탐지 및 위치 보고
- 정의/참조 탐색 인덱스 관리

VS Code에 내장된 tsserver 버전을 확인하려면: `Ctrl+Shift+P` → `TypeScript: Select TypeScript Version`

프로젝트에 설치된 TypeScript 버전을 우선 사용하려면 "Use Workspace Version"을 선택한다. 이렇게 하면 tsconfig.json의 설정이 에디터에도 정확히 반영된다.

## 핵심 기능 활용

![에디터 TypeScript 지원 기능 비교](/assets/posts/ts-editor-setup-features.svg)

### 자동완성 (IntelliSense)

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

const product: Product = { ... };

product.  // Ctrl+Space로 id, name, price, category 목록 표시
```

타입이 정의된 객체에서 `.`을 입력하면 해당 타입의 프로퍼티/메서드만 정확하게 제안된다. 오타를 치면 즉시 에러 표시가 뜬다.

### 호버로 타입 확인

변수나 함수 위에 마우스를 올리거나 `Ctrl+K Ctrl+I`를 누르면 추론된 타입이 팝업으로 표시된다.

```typescript
const arr = [1, 2, 3];
// arr 위에 호버: const arr: number[]

const sum = arr.reduce((acc, n) => acc + n, 0);
// sum 위에 호버: const sum: number
```

### 정의로 이동 (F12)

함수, 타입, 변수 위에서 `F12`를 누르면 선언된 위치로 이동한다. 외부 라이브러리의 `.d.ts` 파일도 열린다. TypeScript를 쓰는 가장 큰 DX 장점 중 하나다.

### 참조 찾기 (Shift+F12)

특정 함수나 타입이 프로젝트 전체에서 어디서 사용되는지 찾는다. 리팩터링 전 영향 범위 파악에 필수다.

### 이름 변경 리팩터링 (F2)

변수나 타입 이름 위에서 `F2`를 누르면 모든 참조 지점을 한 번에 변경한다. TypeScript 타입 정보 덕분에 JavaScript에서보다 훨씬 정확하다.

## VS Code 설정

`settings.json`에 추가하면 TypeScript 개발 경험이 좋아지는 설정들이다.

```json
// .vscode/settings.json
{
  // 저장 시 자동 임포트 정리
  "editor.codeActionsOnSave": {
    "source.organizeImports": "explicit"
  },

  // TypeScript 관련 설정
  "typescript.preferences.quoteStyle": "single",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.suggest.autoImports": true,
  "typescript.inlayHints.parameterNames.enabled": "literals",
  "typescript.inlayHints.variableTypes.enabled": false,

  // 에디터 기본 설정
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

**인레이 힌트(Inlay Hints)**: `typescript.inlayHints` 옵션을 켜면 파라미터 이름과 추론된 타입이 코드 안에 표시된다. 유용하지만 과하면 오히려 가독성을 해친다.

## 필수 확장(Extensions)

VS Code 기본 TypeScript 지원으로도 충분하지만, 다음 확장을 추가하면 생산성이 더 높아진다.

**Prettier - Code formatter**: 코드 포맷 자동화

```bash
npm install --save-dev prettier
```

```json
// .prettierrc
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

**ESLint**: 코드 품질 검사

```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Error Lens**: 에러 메시지를 인라인으로 코드 옆에 표시

**Total TypeScript**: Matt Pocock의 TypeScript 심화 학습 확장

## 키보드 단축키 정리

| 단축키 | 기능 |
|--------|------|
| `F12` | 정의로 이동 |
| `Alt+F12` | 정의 미리보기 |
| `Shift+F12` | 참조 찾기 |
| `F2` | 이름 변경 |
| `Ctrl+.` | 빠른 수정(Quick Fix) |
| `Ctrl+Space` | 자동완성 트리거 |
| `Ctrl+K Ctrl+I` | 타입 힌트 팝업 |
| `Ctrl+Shift+P` | 명령 팔레트 |

## 다른 에디터 선택지

VS Code가 최선이지만 다른 에디터도 TypeScript를 잘 지원한다.

**WebStorm (JetBrains)**: 유료지만 TypeScript 지원이 훌륭하다. 프로젝트 전체 분석이 빠르다.

**Neovim**: `nvim-lspconfig` + `typescript-language-server`로 설정하면 VS Code 수준의 지원이 가능하다.

**Helix**: 현대적인 터미널 편집기. LSP 내장으로 설정이 간단하다.

다음 편에서는 TypeScript의 핵심 개념 중 하나인 **타입 공간과 값 공간**의 차이를 깊이 탐구한다.

---

**지난 글:** [첫 TypeScript 프로그램: Hello, Types!](/posts/ts-first-program/)

**다음 글:** [타입 공간과 값 공간: TypeScript를 이해하는 핵심 개념](/posts/ts-type-vs-value-space/)

<br>
읽어주셔서 감사합니다. 😊
