---
title: "node_modules 호이스팅과 의존성 해석"
description: "Node.js의 node_modules 디렉터리 구조와 모듈 해석 알고리즘을 완전히 정리합니다. npm 플랫 호이스팅, pnpm 심링크 구조, 팬텀 의존성 문제, require() 탐색 순서, .npmrc shamefully-hoist, 버전 충돌 해결 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "node_modules", "호이스팅", "모듈해석", "pnpm", "팬텀의존성"]
featured: false
draft: false
---

[지난 글](/posts/node-monorepo/)에서 모노레포와 워크스페이스를 살펴봤습니다. Node.js가 `require('react')`를 만나면 실제로 어디서 파일을 찾는지, npm과 pnpm의 `node_modules` 구조가 왜 다른지를 이해하면 의존성 문제를 더 빠르게 해결할 수 있습니다.

---

## node_modules 구조 비교

![node_modules 호이스팅 구조 비교](/assets/posts/node-modules-hoisting-structure.svg)

---

## require() 모듈 해석 알고리즘

Node.js CJS 모듈은 현재 파일 위치에서 시작해 루트 방향으로 `node_modules`를 탐색합니다.

![모듈 해석 알고리즘](/assets/posts/node-modules-hoisting-code.svg)

```js
// 내장 모듈 우선
require('fs');      // 바로 반환 — 탐색 없음
require('path');

// 상대 경로는 파일 해석
require('./utils');  // 현재 디렉터리
require('../config');

// 패키지 이름 — node_modules 탐색
require('react');
// 1. ./node_modules/react
// 2. ../node_modules/react
// 3. ../../node_modules/react
// ... 루트까지 반복
```

ESM `import`도 동일한 알고리즘을 사용하지만, 파일 확장자를 명시해야 하고 `package.json`의 `exports` 조건을 추가로 확인합니다.

---

## npm 호이스팅 — 플랫 node_modules

npm v3+는 중첩을 최소화하기 위해 패키지를 루트 `node_modules`로 **호이스팅**합니다.

```
프로젝트 의존성:
  myapp → react@18, react-dom@18
  react-dom@18 → scheduler@0.23

결과 node_modules/:
  react/         ← 호이스팅됨
  react-dom/     ← 호이스팅됨
  scheduler/     ← 호이스팅됨 (팬텀 의존성!)
```

`scheduler`는 `myapp`의 `package.json`에 없지만 `require('scheduler')`가 **성공**합니다. 이것이 **팬텀 의존성**입니다.

```js
// 팬텀 의존성 — 지금은 동작하지만 react-dom 업데이트 후 깨질 수 있음
const { unstable_scheduleCallback } = require('scheduler');
```

---

## 버전 충돌 — 중첩 node_modules

두 패키지가 서로 다른 버전의 같은 의존성을 요구할 때:

```
myapp:
  dep-a@1.0.0 → lodash@4.17.0
  dep-b@2.0.0 → lodash@3.10.0

node_modules/
  lodash/             ← v4.17.0 (더 많이 사용되는 버전 호이스팅)
  dep-a/
  dep-b/
    node_modules/
      lodash/         ← v3.10.0 (중첩 — dep-b 전용)
```

npm은 호이스팅 알고리즘으로 중복을 최소화하지만, 완벽히 없앨 수는 없습니다. `npm dedupe` 명령으로 중복을 수동으로 정리할 수 있습니다.

---

## pnpm 심링크 구조

pnpm은 루트 `node_modules`에 **심링크**만 노출합니다.

```
node_modules/
  react           → .pnpm/react@18.3.0/node_modules/react
  react-dom       → .pnpm/react-dom@18.3.0/node_modules/react-dom
  .pnpm/
    react@18.3.0/
      node_modules/
        react/              ← 실제 파일 (스토어 하드 링크)
        scheduler@0.23.0/   ← react의 의존성 (심링크)
    react-dom@18.3.0/
      node_modules/
        react-dom/
        react/              ← react@18.3.0의 심링크
        scheduler/
```

`require('scheduler')`는 실패합니다. `scheduler`가 루트 `node_modules`에 심링크로 노출되지 않았기 때문입니다. 팬텀 의존성이 원천 차단됩니다.

---

## .npmrc — 호이스팅 조정

pnpm에서 일부 도구가 팬텀 의존성을 필요로 할 때:

```ini
# .npmrc

# 특정 패키지만 호이스팅 (Jest, Babel 등 빌드 도구)
hoist-pattern[]=*jest*
hoist-pattern[]=*babel*
hoist-pattern[]=@testing-library/*

# 모든 패키지 호이스팅 (npm처럼 — 임시 회피책)
shamefully-hoist=true

# 공개 레지스트리
registry=https://registry.npmjs.org/

# CI에서 잠금 파일 엄격 준수
frozen-lockfile=true
```

`shamefully-hoist=true`는 이름처럼 **부끄러운 임시 방편**입니다. 마이그레이션 과정에서만 사용하고, 팬텀 의존성을 `package.json`에 명시적으로 추가해 해결하는 것이 올바른 방법입니다.

---

## overrides / resolutions — 버전 강제

특정 의존성의 버전을 강제로 고정합니다.

```json
// npm: overrides
{
  "overrides": {
    "lodash": "^4.17.21",
    "minimist": "^1.2.8"
  }
}

// yarn: resolutions
{
  "resolutions": {
    "lodash": "^4.17.21"
  }
}

// pnpm: overrides
{
  "pnpm": {
    "overrides": {
      "lodash@<4": "^4.17.21"
    }
  }
}
```

보안 취약점이 있는 간접 의존성을 강제로 업그레이드할 때 유용합니다.

---

## 실전 진단 명령어

```bash
# 의존성 트리 확인
npm ls react
pnpm why react          # react가 어떤 경로로 설치됐는지

# 중복 제거
npm dedupe

# 보안 취약점 검사
npm audit
pnpm audit

# 사용되지 않는 패키지 찾기 (depcheck 도구)
npx depcheck
```

---

**지난 글:** [모노레포 · 워크스페이스 패턴](/posts/node-monorepo/)

<br>
읽어주셔서 감사합니다. 😊
