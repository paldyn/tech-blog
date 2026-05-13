---
title: "모노레포 · 워크스페이스 패턴"
description: "모노레포(Monorepo)의 개념과 Node.js 워크스페이스 설정 방법을 설명합니다. pnpm workspaces, workspace:* 프로토콜, Turborepo 빌드 파이프라인, 공유 설정 패키지, 버전 관리 전략을 실전 예제로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "모노레포", "Turborepo", "pnpm", "workspaces", "모노리포"]
featured: false
draft: false
---

[지난 글](/posts/node-semver/)에서 SemVer와 버전 범위 표기를 살펴봤습니다. 규모가 커진 프로젝트는 여러 패키지로 분리되는데, 이를 하나의 레포지터리에서 관리하는 방식이 **모노레포**입니다. 공유 코드 재사용, 일관된 빌드 도구, 원자적 커밋이 장점입니다.

---

## 모노레포 구조

![모노레포 워크스페이스 구조](/assets/posts/node-monorepo-structure.svg)

---

## pnpm 워크스페이스 설정

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tooling/*'
```

```json
// 루트 package.json
{
  "name": "my-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev":   "turbo dev",
    "test":  "turbo test",
    "lint":  "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  }
}
```

`"private": true`는 루트를 npm에 배포하지 않게 막습니다.

---

## workspace 프로토콜

```json
// apps/web/package.json
{
  "name": "web",
  "dependencies": {
    "@myorg/ui":    "workspace:*",
    "@myorg/utils": "workspace:^"
  }
}
```

`workspace:*`는 로컬 패키지를 심링크로 연결합니다. `npm publish`/`pnpm publish` 시 실제 버전 번호로 자동 치환됩니다.

```bash
# 특정 워크스페이스에 의존성 추가
pnpm add react --filter web
pnpm add typescript --filter '@myorg/*' -D

# 루트에 공유 devDependency 추가
pnpm add -Dw prettier
```

---

## 설정 파일 예시

![모노레포 설정 파일 예시](/assets/posts/node-monorepo-code.svg)

---

## Turborepo 빌드 파이프라인

```bash
# Turborepo 설치
pnpm add -Dw turbo

# 전체 빌드 (의존성 순서 자동 처리)
pnpm turbo build

# 특정 패키지만
pnpm turbo build --filter=web

# 변경된 패키지만 (Git diff 기반)
pnpm turbo build --filter='[HEAD~1]'
```

Turborepo는 이전 빌드 결과를 캐시합니다. 소스가 변경되지 않은 패키지는 캐시에서 즉시 복원합니다. 원격 캐시를 설정하면 팀 전체가 캐시를 공유합니다.

```json
// turbo.json
{
  "remoteCache": {
    "enabled": true
  },
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs":   ["dist/**", ".next/**"],
      "cache":     true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs":   ["coverage/**"]
    },
    "lint": {
      "outputs": []
    }
  }
}
```

`"^build"` — `^`는 의존하는 패키지의 `build`가 먼저 완료되어야 함을 의미합니다.

---

## 공유 설정 패키지

```
tooling/
  eslint-config/
    index.js
    package.json  ← "name": "@myorg/eslint-config"
  tsconfig/
    base.json
    nextjs.json
    package.json  ← "name": "@myorg/tsconfig"
```

```json
// apps/web/package.json의 devDependencies
{
  "@myorg/eslint-config": "workspace:*",
  "@myorg/tsconfig": "workspace:*"
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "@myorg/tsconfig/nextjs.json",
  "include": ["src", "next-env.d.ts"],
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

---

## 버전 관리 전략

| 전략 | 설명 | 도구 |
|------|------|------|
| 고정 버전 | 모든 패키지가 같은 버전 | Lerna fixed mode |
| 독립 버전 | 패키지별 독립 버전 | Lerna independent, changeset |
| 배포 없음 | 내부용 — 버전 불필요 | 루트 scripts만 사용 |

```bash
# changeset으로 독립 버전 관리
pnpm changeset add          # 변경 기록
pnpm changeset version      # 버전 범프
pnpm changeset publish      # 배포
```

---

## nx vs Turborepo

| | Turborepo | Nx |
|-|-----------|-----|
| 설정 복잡도 | 낮음 | 높음 |
| 플러그인 생태계 | 작음 | 풍부함 |
| 원격 캐시 | 유료(Vercel) / 오픈소스 | 유료(Nx Cloud) / 오픈소스 |
| 태스크 그래프 시각화 | CLI | GUI |

---

**지난 글:** [SemVer · Node.js 버전 관리 전략](/posts/node-semver/)

**다음 글:** [node_modules 호이스팅과 의존성 해석](/posts/node-modules-hoisting/)

<br>
읽어주셔서 감사합니다. 😊
