---
title: "Monorepo vs Polyrepo: 어떤 저장소 구조를 선택할까"
description: "Monorepo와 Polyrepo의 구조 차이, 원자적 변경·빌드 시간·권한 분리·의존성 관리 측면의 트레이드오프, Turborepo·Nx 같은 Monorepo 도구, 그리고 팀 상황별 선택 기준을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "Monorepo", "Polyrepo", "Turborepo", "Nx", "저장소구조"]
featured: false
draft: false
---

[지난 글](/posts/trunk-based-development/)에서 Trunk-Based Development를 다뤘다. 브랜치 전략 못지않게 팀 생산성에 영향을 미치는 결정이 하나 더 있다. 코드를 **하나의 저장소(Monorepo)**에 넣을지, **서비스마다 분리된 저장소(Polyrepo)**로 관리할지다.

## 두 가지 접근

**Monorepo**: 여러 애플리케이션, 라이브러리, 서비스를 하나의 Git 저장소에 관리한다.

```
my-company/
├── apps/
│   ├── web/       # React 앱
│   ├── mobile/    # React Native
│   └── api/       # Node.js API
└── packages/
    ├── ui/        # 공유 UI 컴포넌트
    ├── auth/      # 공유 인증 로직
    └── utils/     # 공통 유틸
```

**Polyrepo**: 서비스·라이브러리마다 독립된 저장소를 운영한다.

```
github.com/my-company/
├── web-app/       # 저장소 1
├── mobile-app/    # 저장소 2
├── api-service/   # 저장소 3
└── shared-ui/     # 저장소 4 (NPM 패키지로 배포)
```

![Monorepo vs Polyrepo 구조](/assets/posts/monorepo-vs-polyrepo-structure.svg)

## 트레이드오프

![트레이드오프 비교](/assets/posts/monorepo-vs-polyrepo-tradeoffs.svg)

### 원자적 변경 — Monorepo의 강점

공유 라이브러리의 API를 변경할 때 Monorepo에서는 하나의 커밋·PR로 라이브러리와 모든 사용처를 동시에 수정할 수 있다.

```bash
# Monorepo: 단일 PR
git checkout -b fix/auth-token-refresh
# packages/auth/src/refresh.ts 수정
# apps/web/src/hooks/useAuth.ts 수정 (동시에)
# apps/mobile/src/auth/ 수정 (동시에)
git commit -m "fix(auth): 토큰 갱신 로직 일관성 수정"
```

Polyrepo에서는 `shared-ui` 저장소에 PR → NPM 퍼블리시 → `web-app` 버전업 PR → `mobile-app` 버전업 PR 순서로 최소 3개의 PR이 필요하다.

### 빌드 성능 — Monorepo의 약점

저장소가 커지면 CI 빌드 시간이 늘어난다. 변경이 없는 패키지까지 빌드·테스트하지 않으려면 **증분 빌드(incremental build)** 캐시가 필수다.

```bash
# Turborepo: 변경된 패키지만 빌드
npx turbo build --filter=...web

# Nx: affected 명령
npx nx affected:build --base=main
```

### 권한 분리 — Polyrepo의 강점

팀마다 저장소 접근 권한을 독립적으로 관리할 수 있다. Monorepo에서 같은 수준의 분리를 구현하려면 GitHub의 `CODEOWNERS` 파일이 필요하지만, 여전히 코드를 볼 수 있는 사람의 범위가 넓다.

## Monorepo 도구

단순히 코드를 한 저장소에 모으기만 하면 빌드가 느려지고 관리가 복잡해진다. 아래 도구들이 이 문제를 해결한다.

| 도구 | 특징 |
|---|---|
| **Turborepo** | 원격 캐시, 병렬 실행, JS/TS 중심 |
| **Nx** | 모듈 경계 강제, 다언어 지원 |
| **Bazel** | 구글 출신, 대규모 모노레포, 복잡도 높음 |
| **pnpm workspaces** | Node.js용 경량 모노레포 |

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

## 선택 기준

**Monorepo를 선택할 때:**
- 여러 서비스가 같은 라이브러리를 자주 함께 변경한다
- 팀 간 코드 공유가 빈번하다
- 전사 린팅·포매팅 규칙을 통일하고 싶다
- 소규모 팀 (저장소 관리 오버헤드가 낮음)

**Polyrepo를 선택할 때:**
- 서비스별 팀이 독립적으로 배포 일정을 가진다
- 언어·기술 스택이 서비스마다 크게 다르다
- 저장소 접근 권한을 서비스 단위로 엄격히 분리해야 한다

두 방식은 대립이 아니다. 핵심 공유 코드는 Monorepo로, 독립 서비스는 별도 저장소로 운영하는 **하이브리드** 구성도 흔하다.

---

**지난 글:** [Trunk-Based Development: 브랜치 없이 빠르게](/posts/trunk-based-development/)

**다음 글:** [Branch Protection Rules: 실수 방지 안전망](/posts/branch-protection-rules/)

<br>
읽어주셔서 감사합니다. 😊
