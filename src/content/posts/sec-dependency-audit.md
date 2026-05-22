---
title: "의존성 감사 — npm audit과 공급망 보안"
description: "npm audit으로 알려진 CVE를 스캔하고, 타이포스쿼팅·계정 하이재킹·의존성 혼동 등 공급망 공격을 방어하는 방법과 CI 통합 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "npm audit", "공급망", "의존성", "CVE", "Snyk", "Socket"]
featured: false
draft: false
---

[지난 글](/posts/sec-prototype-pollution/)에서 프로토타입 오염 공격을 살펴봤습니다. 이번에는 시각을 넓혀 **의존성 공급망(Supply Chain)** 보안을 다룹니다. 현대 Node.js 프로젝트는 수백 개의 패키지를 설치하며, 그 중 단 하나라도 악성 코드가 포함되면 전체 애플리케이션이 위협받습니다.

## 공급망 공격이란

공급망 공격(Supply Chain Attack)은 신뢰할 수 있는 소프트웨어 배포 경로에 악성 코드를 주입하는 기법입니다. npm 생태계에서는 주로 네 가지 형태로 나타납니다.

![의존성 공급망 공격 경로](/assets/posts/sec-dependency-audit-supply-chain.svg)

**타이포스쿼팅(Typosquatting):** `lodash` 대신 `l0dash`, `1odash` 같이 오타를 유도하는 패키지를 등록합니다. `npm install` 시 오타를 치면 악성 패키지가 설치됩니다.

**계정 하이재킹:** 인기 패키지 관리자의 npm 토큰을 탈취해 기존 패키지에 악성 버전을 배포합니다. 2021년 `ua-parser-js`, `coa`, `rc` 패키지가 이 방식으로 해킹되었습니다.

**의존성 혼동(Dependency Confusion):** 기업 내부 패키지와 동일한 이름의 패키지를 공개 npm에 더 높은 버전으로 등록합니다. npm은 기본적으로 공개 레지스트리를 우선하므로 악성 패키지가 설치됩니다.

**postinstall 스크립트:** `package.json`의 `"postinstall"` 훅을 통해 설치 즉시 실행되는 코드를 심습니다.

## npm audit 기초

`npm audit`은 설치된 패키지를 npm Advisory Database의 알려진 CVE와 대조합니다.

```bash
# 기본 스캔
npm audit

# 특정 심각도 이상만 보고 (CI에서 빌드 실패 기준 설정)
npm audit --audit-level=high

# JSON 출력 (CI 파싱, 리포트 자동화)
npm audit --json

# 자동 수정 (semver 범위 내 안전한 업그레이드)
npm audit fix

# 메이저 버전 업그레이드 포함 강제 수정 (주의: 브레이킹 체인지 가능)
npm audit fix --force
```

pnpm, Yarn Berry도 각각 `pnpm audit`, `yarn npm audit` 명령을 제공합니다.

## 심각도 등급 이해

npm audit 결과는 `critical → high → moderate → low → info` 5단계로 표시됩니다.

| 등급 | 대응 기준 |
|---|---|
| critical | 즉시 배포 중단, 당일 수정 |
| high | PR 병합 차단, 다음 릴리즈 전 수정 |
| moderate | 다음 스프린트 내 처리 |
| low | 분기별 검토 |
| info | 참고만, 빌드 차단 불필요 |

CI에서는 통상 `--audit-level=high`로 설정해 `high` 이상 취약점이 있으면 빌드를 실패시킵니다.

## npm audit 한계와 보완 도구

`npm audit`은 **알려진 CVE만** 탐지합니다. 등록되지 않은 신종 악성 패키지, 타이포스쿼팅, postinstall 악성 코드는 잡지 못합니다.

```bash
# Snyk: 더 광범위한 취약점 DB + 코드 분석
npx snyk test
npx snyk monitor  # 지속적 모니터링

# Socket: 동작 기반 정적 분석 (네트워크 접근, 환경 변수 접근 등)
npx socket npm install lodash

# retire.js: 프론트엔드 JS 라이브러리 취약점
npx retire --path .
```

**Socket**은 패키지의 실제 동작을 분석합니다. 설치 스크립트가 네트워크 요청을 보내거나 시스템 명령을 실행하면 경고합니다.

## lockfile 무결성 검증

`package-lock.json`이나 `yarn.lock`에는 각 패키지의 정확한 버전과 **integrity hash**가 기록됩니다.

```json
{
  "node_modules/lodash": {
    "version": "4.17.21",
    "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
    "integrity": "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZkGLdHsHhl6LATe7Jw=="
  }
}
```

lockfile을 통해 팀 전원이 동일한 버전을 설치하고, integrity hash로 패키지 변조를 감지합니다. **lockfile을 `.gitignore`에 넣지 마십시오.** CI에서는 `npm ci`로 lockfile을 엄격히 준수해 설치합니다.

```bash
# npm ci: lockfile 변경 없이 정확히 재현
npm ci

# lockfile 변경이 있으면 에러 (의도치 않은 업데이트 방지)
npm ci --prefer-offline
```

## .npmrc 보안 설정

```ini
# 악성 postinstall 스크립트 차단 (설치 후 수동으로 허용)
ignore-scripts=true

# 특정 스코프를 내부 레지스트리로 강제 (의존성 혼동 방어)
@mycompany:registry=https://npm.mycompany.com

# 공개 패키지는 기존 npm 레지스트리 유지
registry=https://registry.npmjs.org
```

`ignore-scripts=true`는 타이포스쿼팅·postinstall 악용을 막는 강력한 방어입니다. 단, 네이티브 모듈(`node-gyp`) 등 설치 스크립트가 필요한 패키지는 `--ignore-scripts=false` 예외 처리해야 합니다.

## CI 파이프라인 통합

![npm audit 감사 워크플로우](/assets/posts/sec-dependency-audit-workflow.svg)

GitHub Actions 예시입니다.

```yaml
name: Security Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: npm audit
        run: npm audit --audit-level=high
      - name: Snyk
        run: npx snyk test --severity-threshold=high
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

Dependabot이나 Renovate Bot을 설정하면 취약한 의존성에 대한 업데이트 PR이 자동으로 생성됩니다.

## 최소 권한 원칙 — devDependencies 분리

프로덕션 빌드에는 `dependencies`만 포함되도록 합니다. 테스트·빌드 도구는 반드시 `devDependencies`에 넣어야 공격 표면이 줄어듭니다.

```bash
# 프로덕션 배포 시 devDependencies 제외
npm install --omit=dev
# 또는
NODE_ENV=production npm install
```

## 정리

의존성 감사는 **npm audit + lockfile 검증 + Socket/Snyk + CI 자동화** 네 축이 함께 작동할 때 효과적입니다. 단 한 번의 `npm audit`으로 끝내지 말고, 매 PR마다 자동 스캔하고 취약점에 즉시 대응하는 문화를 만드는 것이 중요합니다.

---

**지난 글:** [프로토타입 오염 — Prototype Pollution 공격과 방어](/posts/sec-prototype-pollution/)

**다음 글:** [순수 함수와 불변성 — 함수형 프로그래밍의 기초](/posts/fp-pure-immutable/)

<br>
읽어주셔서 감사합니다. 😊
