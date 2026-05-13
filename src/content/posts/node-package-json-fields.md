---
title: "package.json 핵심 필드 완전 정복"
description: "package.json의 모든 핵심 필드를 실전 중심으로 정리합니다. exports 조건부 진입점, main/module/types 차이, dependencies 종류별 구분, engines, sideEffects 트리 셰이킹, scripts 라이프사이클, files 배포 범위까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "package.json", "exports", "dependencies", "semver", "npm"]
featured: false
draft: false
---

[지난 글](/posts/node-package-managers/)에서 npm, yarn, pnpm을 비교했습니다. 이 도구들이 공통으로 읽는 설정 파일이 `package.json`입니다. 패키지의 신원, 의존성, 진입점, 실행 스크립트, 배포 범위를 모두 정의하는 중심 파일입니다.

---

## 핵심 필드 전체 지도

![package.json 핵심 필드 구조](/assets/posts/node-package-json-fields-map.svg)

---

## name · version · private

```json
{
  "name": "@myorg/ui-lib",
  "version": "2.1.0",
  "description": "재사용 가능한 UI 컴포넌트 라이브러리",
  "private": false
}
```

- `name`에 스코프(`@org/`)를 사용하면 조직 패키지를 분리된 네임스페이스로 관리합니다.
- `"private": true`로 설정하면 `npm publish` 실수를 방지합니다.

---

## exports — 조건부 진입점 (현대 표준)

![exports · engines · scripts 필드 예시](/assets/posts/node-package-json-fields-exports.svg)

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./utils": "./dist/utils.mjs",
    "./styles": "./dist/styles.css"
  }
}
```

`exports`가 있으면 `main`/`module`을 덮어씁니다. **서브경로 exports**로 `import 'my-lib/internal'` 같은 내부 경로 접근을 차단할 수 있습니다.

조건 우선순위 (왼쪽이 높음):
```
browser → import → require → default
```

Node.js, 번들러(Vite, Rollup, webpack)가 모두 이 조건을 해석합니다.

---

## dependencies 종류

```json
{
  "dependencies": {
    "express": "^5.0.0"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  },
  "optionalDependencies": {
    "fsevents": "^2.3.0"
  }
}
```

- **`dependencies`**: 런타임에 필요한 패키지
- **`devDependencies`**: 빌드/테스트에만 필요 (`--production` 설치 시 제외)
- **`peerDependencies`**: 라이브러리가 소비자의 패키지를 공유해야 할 때 선언
- **`optionalDependencies`**: 설치 실패 시 에러 없이 계속 진행

---

## scripts — npm 라이프사이클

```json
{
  "scripts": {
    "prepare":   "node scripts/check-version.js",
    "prebuild":  "tsc --noEmit",
    "build":     "vite build",
    "postbuild": "node scripts/copy-types.js",
    "dev":       "vite",
    "test":      "vitest run",
    "test:watch": "vitest",
    "lint":      "eslint src --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "prepack":   "npm run build",
    "release":   "changeset publish"
  }
}
```

`pre`/`post` 접두사를 붙이면 스크립트 전후에 자동 실행됩니다. `npm run build`를 실행하면 `prebuild` → `build` → `postbuild` 순으로 실행됩니다.

라이프사이클 이벤트(자동 실행):
- `prepare`: `npm install` 완료 후, `npm publish` 전
- `prepublishOnly`: `npm publish` 직전

---

## engines · sideEffects

```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm":  ">=9.0.0"
  },
  "sideEffects": false
}
```

`"sideEffects": false`는 번들러에게 "이 패키지의 모든 모듈은 부수 효과 없이 트리 셰이킹 가능"임을 알립니다. CSS 임포트가 있는 경우 제외할 수 있습니다:

```json
{
  "sideEffects": ["./src/global.css", "./src/polyfills.js"]
}
```

---

## files — 배포 포함 범위

```json
{
  "files": [
    "dist",
    "src",
    "!**/*.test.*",
    "!**/*.spec.*"
  ]
}
```

`files`에 나열된 파일/디렉터리만 npm에 배포됩니다. 지정하지 않으면 `.npmignore`이 없을 경우 대부분의 파일이 포함됩니다. `README.md`, `package.json`, `LICENSE`는 항상 포함됩니다.

---

## 라이브러리 배포용 최소 템플릿

```json
{
  "name": "@myorg/lib",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "import":  "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types":   "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "sideEffects": false,
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test":  "vitest run"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

---

**지난 글:** [npm · yarn · pnpm 패키지 매니저 비교](/posts/node-package-managers/)

**다음 글:** [SemVer · Node.js 버전 관리 전략](/posts/node-semver/)

<br>
읽어주셔서 감사합니다. 😊
