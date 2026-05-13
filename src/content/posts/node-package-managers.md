---
title: "npm · yarn · pnpm 패키지 매니저 비교"
description: "Node.js 생태계의 세 가지 패키지 매니저 npm·yarn·pnpm을 심층 비교합니다. 설치 방식, 잠금 파일, 팬텀 의존성 문제, pnpm의 콘텐츠 주소 스토어, yarn PnP, corepack, workspaces 모노레포 지원까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "npm", "yarn", "pnpm", "패키지매니저", "모노레포"]
featured: false
draft: false
---

[지난 글](/posts/node-debugging-inspect/)에서 Node.js 디버깅 방법을 살펴봤습니다. JavaScript 프로젝트는 수십~수백 개의 외부 패키지에 의존합니다. 이를 설치·관리·업데이트하는 도구가 **패키지 매니저**입니다. npm, yarn, pnpm은 각각 다른 철학과 최적화를 가집니다.

---

## 비교 개요

![npm · yarn · pnpm 패키지 매니저 비교](/assets/posts/node-package-managers-compare.svg)

---

## npm — Node.js 기본 패키지 매니저

npm은 Node.js 설치 시 자동으로 포함됩니다. 플랫 `node_modules` 구조를 사용합니다.

```bash
# 설치 및 기본 사용
npm install                    # package.json 의존성 전체 설치
npm install react              # 패키지 추가 (dependencies)
npm install -D typescript      # 개발 의존성 (devDependencies)
npm install -g nodemon         # 전역 설치
npm uninstall lodash           # 패키지 제거
npm update                     # 업데이트 가능한 패키지 업데이트

# 스크립트
npm run build
npm test                       # npm run test 단축
npm start                      # npm run start 단축

# 레지스트리 조회
npm info react                 # 패키지 정보
npm ls                         # 의존성 트리 출력
npm audit                      # 보안 취약점 검사
npm audit fix                  # 자동 수정 가능한 취약점 수정
```

`package-lock.json`은 정확한 버전을 기록합니다. 반드시 버전 관리에 포함하세요.

---

## yarn — 향상된 성능과 결정론적 설치

yarn v1(classic)은 오프라인 캐시와 병렬 설치로 npm v5 이전의 속도 문제를 해결했습니다. yarn v3+(berry)는 Plug'n'Play(PnP) 방식을 도입합니다.

```bash
# 기본 사용
yarn                           # 전체 설치
yarn add react                 # 패키지 추가
yarn add -D eslint             # 개발 의존성
yarn remove lodash             # 제거
yarn upgrade react             # 업그레이드

# PnP 관련
yarn dlx create-next-app       # npx와 동일
yarn node app.js               # PnP 환경에서 Node.js 실행
```

### yarn PnP (Plug'n'Play)

yarn berry의 PnP는 `node_modules` 디렉터리를 생성하지 않습니다. 대신 `.yarn/cache`에 ZIP 파일로 패키지를 저장하고, `.pnp.cjs` 파일이 패키지 위치를 Node.js에 알려줍니다.

- 설치 속도 대폭 향상 (node_modules 수백만 파일 → ZIP 몇백 개)
- Zero-Install: `.yarn/cache`를 커밋하면 `yarn install` 없이 CI 실행 가능
- 단점: 일부 CJS 패키지와 호환성 문제

---

## pnpm — 콘텐츠 주소 저장소

pnpm은 `~/.pnpm-store`(또는 `.pnpm-store`)에 패키지를 **한 번만 저장**하고, 프로젝트의 `node_modules`에는 **하드 링크**로 연결합니다. 동일한 패키지를 여러 프로젝트에서 사용해도 디스크에 한 번만 존재합니다.

![패키지 매니저 주요 명령어](/assets/posts/node-package-managers-code.svg)

```bash
# 기본 사용
pnpm install
pnpm add react
pnpm add -D vite
pnpm remove lodash
pnpm update

# 전역
pnpm add -g typescript

# 모노레포
pnpm -r run build              # 전체 워크스페이스 빌드
pnpm --filter ./packages/app run dev  # 특정 패키지만
```

### 팬텀 의존성 차단

npm의 플랫 `node_modules`에서는 직접 의존하지 않은 패키지도 `require('패키지명')`으로 접근할 수 있습니다. 이를 **팬텀 의존성**이라 합니다.

pnpm은 심링크 기반 구조로 이를 방지합니다.

```
node_modules/
  .pnpm/                   ← 실제 파일 (콘텐츠 주소 스토어 하드 링크)
    react@18.3.0/
    lodash@4.17.21/
  react → .pnpm/react@18.3.0/node_modules/react  (심링크)
  // lodash는 package.json에 없으면 접근 불가
```

---

## corepack — 버전 관리

Node.js 16.13+에 내장된 corepack은 프로젝트별 패키지 매니저 버전을 강제합니다.

```bash
corepack enable                # corepack 활성화

# package.json에 버전 지정
# "packageManager": "pnpm@9.0.0"

# 자동으로 올바른 버전 사용
pnpm install   # corepack이 pnpm@9.0.0 사용 보장
```

```json
{
  "packageManager": "pnpm@9.0.0+sha256.abcdef..."
}
```

팀 전체가 동일한 패키지 매니저 버전을 사용하도록 강제할 수 있습니다.

---

## 무엇을 선택해야 하나?

| 상황 | 권장 |
|------|------|
| 새 프로젝트, 모노레포 | pnpm |
| 기존 yarn v1 프로젝트 | yarn berry 마이그레이션 검토 |
| 간단한 스크립트, 빠른 시작 | npm |
| CI 캐시 최적화 중요 | pnpm 또는 yarn PnP |

실무에서는 **pnpm**이 점유율을 빠르게 높이고 있습니다. 특히 모노레포 프로젝트에서 디스크 효율과 팬텀 의존성 차단이 강점입니다.

---

**지난 글:** [디버깅 · Node.js inspect와 진단 도구](/posts/node-debugging-inspect/)

**다음 글:** [package.json 핵심 필드 완전 정복](/posts/node-package-json-fields/)

<br>
읽어주셔서 감사합니다. 😊
