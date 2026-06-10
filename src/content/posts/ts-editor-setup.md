---
title: "VS Code + TypeScript 에디터 설정"
description: "VS Code의 TypeScript IntelliSense 기능(자동완성, 타입 힌트, 오류 표시, F12 이동)을 최대한 활용하는 설정 방법과 생산성을 높이는 필수 확장 프로그램을 소개합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "VSCode", "IntelliSense", "에디터", "개발환경", "확장"]
featured: false
draft: false
---

[지난 글](/posts/ts-first-program/)에서 첫 TypeScript 프로그램을 작성하고 실행했습니다. 이번 글에서는 VS Code를 TypeScript 개발에 최적화하는 설정을 다룹니다. 에디터 설정 하나하나가 개발 생산성에 직접 영향을 줍니다.

## VS Code는 TypeScript로 만들어졌다

VS Code 자체가 TypeScript로 작성된 에디터입니다. 따라서 TypeScript 지원이 기본 내장되어 있으며, 별도의 TypeScript 확장을 설치하지 않아도 됩니다. TypeScript Language Server(tsserver)가 내장되어 있어 설치 즉시 자동완성, 타입 힌트, 오류 표시가 동작합니다.

![VS Code TypeScript 기능](/assets/posts/ts-editor-setup-features.svg)

## IntelliSense 주요 기능

### 자동완성 (Ctrl+Space)

객체의 속성이나 메서드를 입력할 때 `.`을 누르면 타입 정보를 기반으로 정확한 자동완성 목록이 표시됩니다.

```typescript
interface Config {
  host: string;
  port: number;
  timeout: number;
  retries: number;
}

const config: Config = {
  host: "localhost",
  port: 3000,
  timeout: 5000,
  retries: 3,
};

config. // ← host, port, timeout, retries 자동완성
```

### 마우스 호버 타입 정보

변수나 함수 위에 마우스를 올리면 추론된 타입 정보가 팝업으로 표시됩니다. 복잡한 타입을 이해하는 데 매우 유용합니다.

### 정의로 이동 (F12)

함수나 타입 위에서 `F12`를 누르면 정의된 파일로 즉시 이동합니다. 외부 라이브러리의 경우 `.d.ts` 파일로 이동하여 타입 정의를 확인할 수 있습니다.

```typescript
// fetch 위에서 F12 → lib.dom.d.ts로 이동
const response = await fetch("/api/data");
```

### 심볼 이름 변경 (F2)

변수나 함수 위에서 `F2`를 누르면 프로젝트 전체에서 해당 심볼의 이름을 안전하게 변경합니다. 모든 참조가 동시에 업데이트됩니다.

### 코드 액션 (Ctrl+.)

오류 또는 경고가 있는 줄에서 `Ctrl+.`를 누르면 빠른 수정 제안이 표시됩니다. 누락된 `import` 자동 추가, 타입 오류 수정 제안, 리팩토링 옵션 등이 포함됩니다.

## settings.json 권장 설정

`Ctrl+Shift+P` → "Open User Settings (JSON)"으로 설정 파일을 열고 아래 내용을 추가합니다.

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.inlayHints.enabled": "on",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.suggest.autoImports": true,
  "typescript.inlayHints.parameterNames.enabled": "literals",
  "typescript.inlayHints.variableTypes.enabled": true,
  "javascript.suggest.autoImports": true
}
```

- `inlayHints`: 코드 옆에 추론된 타입을 회색으로 표시 (선택 사항)
- `updateImportsOnFileMove`: 파일 이동 시 `import` 경로 자동 업데이트
- `organizeImports`: 저장 시 사용하지 않는 import 정리

## 필수 확장 프로그램

![필수 확장 목록](/assets/posts/ts-editor-setup-extensions.svg)

```bash
# VS Code에서 설치: Ctrl+Shift+X 후 검색
# 또는 CLI
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension usernamehw.errorlens
```

**ESLint**: TypeScript 코드 품질 검사. `@typescript-eslint` 플러그인과 함께 사용

**Prettier**: 일관된 코드 포맷. TypeScript, JSON, CSS 모두 지원

**Error Lens**: 오류와 경고를 코드 줄 옆에 인라인으로 표시. 물결선 위에 마우스를 올리지 않아도 됩니다

## 프로젝트에서 사용할 TypeScript 버전 고정

VS Code는 기본적으로 내장된 TypeScript를 사용합니다. 프로젝트의 `node_modules`에 설치된 TypeScript 버전을 사용하도록 설정하는 것을 권장합니다.

1. TypeScript 파일을 열고 `Ctrl+Shift+P`
2. "TypeScript: Select TypeScript Version" 선택
3. "Use Workspace Version" 선택

또는 프로젝트 `.vscode/settings.json`에 명시합니다.

```json
{
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

에디터 설정은 개인 취향에 따라 다르지만, ESLint + Prettier + Error Lens 조합은 TypeScript 생산성을 크게 높이는 표준 설정으로 널리 사용됩니다.

---

**지난 글:** [첫 TypeScript 프로그램 작성하기](/posts/ts-first-program/)

**다음 글:** [타입 공간과 값 공간: TypeScript의 두 세계](/posts/ts-type-vs-value-space/)

<br>
읽어주셔서 감사합니다. 😊
