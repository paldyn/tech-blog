---
title: "TypeScript 에디터 설정 — VS Code 완벽 최적화"
description: "VS Code에서 TypeScript 개발 경험을 극대화하는 설정, 확장 프로그램, 단축키, 그리고 팀 공유 설정 방법을 소개합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "VSCode", "에디터", "IntelliSense", "개발환경"]
featured: false
draft: false
---

[지난 글](/posts/ts-first-program/)에서 첫 TypeScript 프로그램을 작성했습니다. 좋은 에디터 설정은 개발 생산성을 몇 배로 높여줍니다. VS Code에서 TypeScript 개발 경험을 극대화하는 방법을 알아봅니다.

![VS Code TypeScript 지원](/assets/posts/ts-editor-setup-vscode.svg)

## VS Code의 기본 TypeScript 지원

VS Code는 TypeScript로 개발되었고, TypeScript Language Server를 내장하고 있습니다. 별도 설치 없이도 다음 기능이 활성화됩니다.

- **IntelliSense**: 타입 기반 자동완성, 함수 시그니처 힌트
- **실시간 오류 표시**: 저장 없이 코드 작성 중 즉시 표시
- **Go to Definition**: `F12`로 정의 위치로 이동
- **리팩터링**: `F2`로 모든 참조 일괄 변경
- **자동 Import**: 사용 시 자동으로 import 추가

## 핵심 확장 프로그램

![IntelliSense 데모](/assets/posts/ts-editor-setup-intellisense.svg)

### 필수 설치

```json
// 권장 확장 프로그램 목록 (.vscode/extensions.json)
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "usernamehw.errorlens",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

**ESLint** (`dbaeumer.vscode-eslint`): 코드 품질 검사. `@typescript-eslint/eslint-plugin`과 함께 사용하면 TypeScript 특화 규칙 적용.

**Prettier** (`esbenp.prettier-vscode`): 일관된 코드 포맷팅. 저장 시 자동 포맷 설정 권장.

**Error Lens** (`usernamehw.errorlens`): 오류를 코드 줄 옆에 인라인으로 표시. hover 없이 즉시 오류 내용 확인.

**TypeScript Nightly** (`ms-vscode.vscode-typescript-next`): 최신 TypeScript 기능을 릴리스 전에 체험.

## VS Code 설정 최적화

`.vscode/settings.json`에 프로젝트별 설정을 저장하면 팀원 전체에 공유됩니다.

```json
{
  // 저장 시 자동 포맷
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",

  // ESLint 자동 수정
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },

  // TypeScript 서버 설정
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.suggest.autoImports": true,

  // 파일 이동 시 import 자동 업데이트
  "javascript.updateImportsOnFileMove.enabled": "always",

  // 타입 힌트 표시 (변수 옆에 추론된 타입 표시)
  "typescript.inlayHints.variableTypes.enabled": true,
  "typescript.inlayHints.parameterNames.enabled": "all",
  "typescript.inlayHints.returnTypes.enabled": true
}
```

## inlay hints: 추론된 타입 표시

VS Code의 inlay hints 기능을 켜면 TypeScript가 추론한 타입이 코드 옆에 표시됩니다.

```typescript
// inlayHints 활성화 시 IDE에서 보이는 모습:
const users /*: User[]*/ = await fetchUsers();
const first /*: User | undefined*/ = users[0];
const name /*: string*/ = first?.name ?? "Unknown";

function getTotal(items /*: CartItem[]*/) /*: number*/ {
  return items.reduce((sum /*: number*/, item /*: CartItem*/) =>
    sum + item.price * item.quantity, 0);
}
```

## 타입 힌트 즉시 보기 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl+K Ctrl+I` | 커서 위치 타입 정보 팝업 |
| `F12` | 정의로 이동 (Go to Definition) |
| `Alt+F12` | 정의 Peek (파일 이동 없이 확인) |
| `Shift+F12` | 모든 참조 찾기 |
| `F2` | 심볼 이름 변경 (모든 참조 업데이트) |
| `Ctrl+.` | 코드 액션 (Quick Fix) |
| `Ctrl+Space` | 자동완성 강제 트리거 |

## TypeScript + ESLint 설정

```bash
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint
```

```javascript
// eslint.config.mjs (ESLint 9+)
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unused-vars": "error"
    }
  }
];
```

## Prettier + TypeScript 설정

```bash
npm install --save-dev prettier
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

## TypeScript 오류 메시지 개선

기본 TypeScript 오류 메시지가 길고 읽기 어렵다면 **Pretty TypeScript Errors** 확장을 설치하세요.

```
// 기본 오류 메시지
Type '{ id: number; nam: string; }' is not assignable to type 'User'.
Object literal may only specify known properties, and 'nam' does not exist in type 'User'.

// Pretty TypeScript Errors 적용 후
✗ 'nam' → 알 수 없는 속성
  혹시 'name'을 입력하셨나요?
```

에디터를 잘 설정하면 TypeScript의 모든 장점을 최대한 누릴 수 있습니다. 특히 inlay hints와 Error Lens의 조합은 코드를 작성하는 내내 타입 정보를 눈앞에 보여주어 실수를 크게 줄여줍니다.

---

**지난 글:** [첫 TypeScript 프로그램 작성하기](/posts/ts-first-program/)

**다음 글:** [타입 공간과 값 공간 — TypeScript의 두 세계](/posts/ts-type-vs-value-space/)

<br>
읽어주셔서 감사합니다. 😊
