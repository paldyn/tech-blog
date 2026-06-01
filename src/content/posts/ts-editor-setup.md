---
title: "TypeScript 완전 정복 ⑧: 에디터 설정 (VS Code + TypeScript)"
description: "VS Code에서 TypeScript 개발 경험을 극대화하는 설정. 확장 프로그램, settings.json, ESLint, Prettier, 단축키까지 완전 가이드."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "VSCode", "ESLint", "Prettier", "에디터설정", "개발환경"]
featured: false
draft: false
---

[지난 글](/posts/ts-first-program/)에서 첫 TypeScript 프로그램을 작성했다. TypeScript의 진가는 좋은 에디터 설정과 함께할 때 발휘된다. 이번 글에서는 VS Code를 TypeScript 최강 개발 환경으로 만드는 방법을 설명한다.

## VS Code + TypeScript 기본 동작

VS Code는 TypeScript 서버(`tsserver`)를 기본 내장하고 있다. 별도 설정 없이도 `.ts` 파일을 열면 자동완성, 타입 오류 표시, 리팩터링 기능이 동작한다. 이것이 VS Code가 TypeScript 개발자들에게 가장 인기 있는 이유다.

```typescript
// VS Code에서 이 코드를 입력해보자
interface Product {
  name: string;
  price: number;
}

const p: Product = {
  name: "Apple",
  price: 1000,
};

// p. 를 입력하는 순간 name, price 자동완성 제안
// p.nme 입력 시 즉시 빨간 밑줄 + 오류 메시지
```

## 핵심 설정과 확장 프로그램

![VS Code + TypeScript 핵심 설정](/assets/posts/ts-editor-setup-vscode.svg)

### 필수 확장 프로그램 설치

```bash
# VS Code 커맨드 팔레트 (Ctrl+Shift+X)에서 검색하거나
# CLI로 설치:
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension usernamehw.errorlens
code --install-extension streetsidesoftware.code-spell-checker
```

**Error Lens**는 오류를 별도 패널이 아닌 해당 코드 줄 옆에 인라인으로 표시해준다. TypeScript 개발 경험을 크게 향상시키는 확장이다.

### .vscode/settings.json 설정

프로젝트 루트에 `.vscode/settings.json`을 만들어 팀 전체가 동일한 설정을 공유할 수 있다.

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "editor.codeActionsOnSave": {
    "source.organizeImports": "explicit",
    "source.fixAll.eslint": "explicit"
  },
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.inlayHints.parameterNames.enabled": "literals",
  "typescript.inlayHints.variableTypes.enabled": false
}
```

`typescript.inlayHints.parameterNames`를 활성화하면 함수 호출 시 매개변수 이름이 인라인으로 표시돼 코드 가독성이 높아진다.

## Prettier 설정

```bash
npm install --save-dev prettier
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "avoid"
}
```

```
# .prettierignore
dist/
node_modules/
*.min.js
```

## ESLint + TypeScript 설정

![ESLint + TypeScript 설정](/assets/posts/ts-editor-setup-eslint.svg)

```bash
npm install --save-dev eslint typescript-eslint globals
```

```javascript
// eslint.config.js (ESLint 9.x Flat Config)
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  }
);
```

`no-floating-promises` 규칙은 `await` 없이 Promise를 반환하는 함수를 호출할 때 경고를 준다. 비동기 코드에서 흔한 실수를 방지한다.

## 유용한 VS Code 단축키

| 단축키 | 기능 |
|--------|------|
| `F12` | 정의로 이동 |
| `Alt+F12` | 정의 피크 (팝업으로 보기) |
| `Shift+F12` | 참조 찾기 |
| `F2` | 심볼 이름 변경 (모든 참조 동시 변경) |
| `Ctrl+.` | 빠른 수정 (Quick Fix) |
| `Ctrl+Shift+I` | import 정리 |
| `Ctrl+Space` | 자동완성 트리거 |
| `Ctrl+Shift+P` → "TypeScript: Restart TS Server" | TS 서버 재시작 |

특히 `F2` (심볼 이름 변경)은 TypeScript의 강점을 잘 보여준다. 인터페이스 필드명을 바꾸면 그 필드를 사용하는 모든 파일이 자동으로 업데이트된다.

## TypeScript 서버 버전 선택

VS Code는 자체 TypeScript 버전을 내장하고 있지만, 프로젝트 로컬에 설치된 TypeScript 버전을 사용하는 것이 권장된다.

`Ctrl+Shift+P` → "TypeScript: Select TypeScript Version" → "Use Workspace Version"

이렇게 하면 팀 전체가 `package.json`에 명시된 동일 버전을 사용하게 된다.

## 다른 에디터 지원

VS Code가 아닌 에디터를 사용한다면:

```bash
# Neovim: nvim-lspconfig + typescript-language-server
npm install -g typescript typescript-language-server

# WebStorm: JetBrains IDE — TypeScript 지원 기본 내장
# 별도 플러그인 불필요, tsconfig.json 자동 감지

# Vim: coc-tsserver 플러그인
# :CocInstall coc-tsserver
```

## 정리

VS Code + TypeScript는 내장 `tsserver` 덕분에 설치만으로 기본 지원이 된다. Error Lens로 오류를 인라인에 표시하고, Prettier로 저장 시 자동 포매팅, ESLint로 코드 품질을 관리하면 탄탄한 개발 환경이 완성된다. `F2` 리네임과 `F12` 정의 이동은 TypeScript 개발의 핵심 워크플로우다.

---

**지난 글:** [첫 TypeScript 프로그램 작성](/posts/ts-first-program/)

**다음 글:** [타입 공간 vs 값 공간](/posts/ts-type-vs-value-space/)

<br>
읽어주셔서 감사합니다. 😊
