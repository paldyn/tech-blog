---
title: "SemVer · Node.js 버전 관리 전략"
description: "Semantic Versioning(SemVer)의 MAJOR.MINOR.PATCH 규칙과 npm 버전 범위 연산자(^, ~, >=, x)를 완전히 정리합니다. 사전 배포 버전, 잠금 파일 전략, changeset을 이용한 버전 자동화, engines 필드 검증까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "SemVer", "버전관리", "npm", "changeset", "패키지"]
featured: false
draft: false
---

[지난 글](/posts/node-package-json-fields/)에서 `package.json`의 `version` 필드와 `dependencies` 범위 표기를 살펴봤습니다. 이 범위 표기의 기반이 되는 **Semantic Versioning(SemVer)** 규약을 이해하면 의존성 충돌을 예방하고 라이브러리를 안전하게 배포할 수 있습니다.

---

## SemVer 구조

```
MAJOR.MINOR.PATCH[-prerelease][+buildmetadata]
  2  .  1  .   0  - beta.1    + 20240501
```

- **MAJOR**: 이전 버전과 **호환되지 않는** API 변경 (breaking change)
- **MINOR**: 이전 버전과 **호환되는** 기능 추가
- **PATCH**: 이전 버전과 호환되는 **버그 수정**
- **0.y.z**: 초기 개발 단계 — MINOR가 breaking 변경으로 취급될 수 있음

---

## 버전 범위 연산자

![SemVer 버전 범위 시각화](/assets/posts/node-semver-ranges.svg)

```json
{
  "dependencies": {
    "express": "^5.0.0",
    "lodash":  "~4.17.0",
    "vitest":  ">=2.0.0 <3.0.0",
    "exact":   "1.2.3",
    "any":     "*",
    "xrange":  "1.x"
  }
}
```

| 표기 | 허용 범위 | 설명 |
|------|----------|------|
| `^1.2.3` | `>=1.2.3 <2.0.0` | Major 고정 (가장 많이 사용) |
| `~1.2.3` | `>=1.2.3 <1.3.0` | Minor 고정 (Patch만 업데이트) |
| `>=1.0.0 <2.0.0` | 명시적 범위 | 비교 연산자 |
| `1.x` | `>=1.0.0 <2.0.0` | x 와일드카드 |
| `*` | 모든 버전 | 권장하지 않음 |

---

## 사전 배포 버전 (pre-release)

```bash
# 알파 → 베타 → RC → 정식
1.0.0-alpha.1
1.0.0-beta.1
1.0.0-rc.1
1.0.0

# npm dist-tag로 사전 배포
npm publish --tag beta
npm install my-pkg@beta
npm install my-pkg@1.0.0-beta.1

# 범위에서 사전 배포 제외
# ^1.0.0은 1.0.0-alpha 포함 안 함
```

`^1.0.0`은 `1.0.0-alpha.1`을 만족시키지 않습니다. 사전 배포 버전은 명시적으로 지정해야 설치됩니다.

---

## semver 패키지 — 프로그래매틱 검증

![semver npm 패키지 사용 예제](/assets/posts/node-semver-code.svg)

```js
import semver from 'semver';

// 엔진 버전 검증 (앱 시작 시)
const required = '>=18.0.0';
const current = process.version;

if (!semver.satisfies(current, required)) {
  console.error(`Node.js ${required} 이상 필요. 현재: ${current}`);
  process.exit(1);
}

// 버전 배열 정렬
const versions = ['1.0.0', '2.0.0', '1.5.0', '0.9.0'];
versions.sort(semver.compare); // ['0.9.0', '1.0.0', '1.5.0', '2.0.0']

// 유효성 검사
semver.valid('1.2.3');          // '1.2.3'
semver.valid('v1.2.3');         // '1.2.3' (v 접두사 허용)
semver.valid('not-a-version');  // null

// 범위 최소/최대 버전
semver.minVersion('^1.2.3');    // '1.2.3'
semver.maxSatisfying(versions, '^1.0.0'); // '1.5.0'
```

---

## 잠금 파일 전략

```bash
# 잠금 파일은 반드시 커밋
# — package-lock.json / yarn.lock / pnpm-lock.yaml

# CI에서 잠금 파일 기반 정확한 설치
npm ci               # package-lock.json 엄격히 준수
yarn install --frozen-lockfile
pnpm install --frozen-lockfile
```

`npm install`은 범위 내에서 최신 버전을 설치하지만, `npm ci`는 잠금 파일의 정확한 버전만 설치합니다. CI/CD에서는 항상 `npm ci`를 사용하세요.

---

## changeset — 버전 변경 자동화

모노레포나 라이브러리 프로젝트에서 버전 관리를 자동화합니다.

```bash
# changeset 설치 및 초기화
pnpm add -D @changesets/cli
pnpm changeset init

# 변경 사항 기록 (PR별)
pnpm changeset add
# → patch / minor / major 선택
# → 변경 설명 작성

# 버전 범프 + CHANGELOG 생성
pnpm changeset version

# 배포
pnpm changeset publish
```

각 PR에서 `pnpm changeset add`로 변경 종류를 기록하면, 릴리스 시 자동으로 버전이 계산되고 `CHANGELOG.md`가 생성됩니다.

---

## npm dist-tag 관리

```bash
# latest(기본), next, beta 등 태그 관리
npm dist-tag add my-pkg@2.0.0-beta.1 beta
npm dist-tag add my-pkg@1.9.9 legacy

# 최신 안정 버전 유지
npm dist-tag add my-pkg@2.0.0 latest

# 설치
npm install my-pkg          # latest 사용
npm install my-pkg@beta     # beta 태그 사용
npm install my-pkg@legacy   # legacy 태그 사용
```

---

**지난 글:** [package.json 핵심 필드 완전 정복](/posts/node-package-json-fields/)

**다음 글:** [모노레포 · 워크스페이스 패턴](/posts/node-monorepo/)

<br>
읽어주셔서 감사합니다. 😊
