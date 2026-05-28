---
title: "GitLab Flow: 환경 브랜치로 안전하게 배포하기"
description: "GitLab Flow의 두 가지 변형(환경 브랜치 기반·릴리즈 브랜치 기반), 업스트림 방향 머지 원칙, GitHub Flow와의 차이점, 그리고 팀 상황에 따른 선택 기준을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "GitLab Flow", "브랜치전략", "환경브랜치", "배포", "워크플로우"]
featured: false
draft: false
---

[지난 글](/posts/github-flow-overview/)에서 GitHub Flow를 다뤘다. GitHub Flow는 단순하지만 "main에 머지하면 즉시 프로덕션 배포"라는 전제가 부담스럽거나, 스테이징 환경에서 별도 검증이 필요한 팀에는 맞지 않는다. **GitLab Flow**는 이 간격을 메우기 위해 환경 브랜치(environment branch)를 추가한 전략이다.

## GitLab Flow의 핵심 원칙

GitLab Flow는 두 가지 변형이 있다.

1. **환경 브랜치(environment branch) 기반**: `main`, `staging`, `production` 같이 각 배포 환경마다 전용 브랜치를 둔다
2. **릴리즈 브랜치(release branch) 기반**: `main`에서 `release/1.x`, `release/2.x` 같은 버전 브랜치를 만들어 운영한다

두 변형 모두 공통 원칙이 있다: **머지는 항상 업스트림 방향으로만** 한다.

```
feature → main → staging → production  ← 환경 브랜치 기반
feature → main → release/1.x          ← 릴리즈 브랜치 기반
```

다운스트림(예: production → staging) 방향 머지는 엄격히 금지한다. 그렇게 하면 다른 팀이 staging에 올린 변경이 production에 사라지는 사고가 생긴다.

## 환경 브랜치 기반 GitLab Flow

가장 일반적인 변형이다. 브랜치가 배포 환경 그 자체를 나타낸다.

![GitLab Flow 환경 브랜치 구조](/assets/posts/gitlab-flow-overview-flow.svg)

### 작업 흐름

```bash
# ① feature 브랜치 생성 (main에서 분기)
git checkout main && git pull
git checkout -b feature/user-profile

# ② 작업 후 main으로 PR
git push -u origin feature/user-profile
# → GitLab에서 MR(Merge Request) 생성, 리뷰, CI 통과 후 main 머지

# ③ main → staging 머지 (CI/CD 자동 또는 수동)
git checkout staging
git merge main
git push origin staging

# ④ 검증 완료 후 staging → production 머지
git checkout production
git merge staging
git push origin production
```

staging에서 문제가 발견되면 production 머지 전에 hotfix를 main에 적용하고 다시 staging을 통과시킨다.

### 환경별 브랜치 보호

GitLab의 **Protected Branches** 기능으로 `staging`과 `production`에 대한 직접 push를 막고, 특정 역할(Maintainer 이상)만 머지할 수 있도록 강제한다.

```yaml
# .gitlab-ci.yml 환경 자동 배포 예시
deploy-staging:
  stage: deploy
  script: ./deploy.sh staging
  only:
    - staging

deploy-production:
  stage: deploy
  script: ./deploy.sh production
  only:
    - production
```

## 릴리즈 브랜치 기반 GitLab Flow

패키지 소프트웨어나 여러 버전을 동시에 지원해야 하는 제품에 적합하다.

```bash
# main에서 릴리즈 브랜치 생성
git checkout -b release/2.3 main

# 릴리즈 브랜치에 버그픽스 → main에도 cherry-pick 또는 merge
git checkout release/2.3
git cherry-pick <fix-commit>

# 릴리즈 태그
git tag v2.3.1
git push origin v2.3.1
```

버그픽스는 **main에 먼저** 적용하고, `git cherry-pick`으로 해당 릴리즈 브랜치에 포팅한다. 릴리즈 브랜치에 직접 작성하고 main에 올리는 방식은 사용하지 않는다.

## GitHub Flow vs GitLab Flow

![GitHub Flow vs GitLab Flow 비교](/assets/posts/gitlab-flow-overview-compare.svg)

| | GitHub Flow | GitLab Flow |
|---|---|---|
| 브랜치 수 | 2종 (feature + main) | 3~4종 (feature + main + env) |
| 배포 시점 | main 머지 즉시 | 환경 브랜치 머지 시 |
| 적합한 팀 | SaaS / 지속 배포 | 스테이징 검증 필요 팀 |
| 복잡도 | 낮음 | 중간 |

## GitLab Flow가 적합한 경우

- 스테이징에서 QA 검증이 필수인 팀
- `main` → 프로덕션 직접 배포가 부담스러운 팀
- 복수 버전을 동시에 지원해야 하는 제품 (릴리즈 브랜치 변형)
- GitLab의 Environments / Protected Branches 기능을 활용 중인 팀

GitHub Flow보다 브랜치가 하나 더 생기지만, 그만큼 "배포 준비 완료"와 "코드 작성 완료"를 명확히 분리할 수 있다.

---

**지난 글:** [GitHub Flow: 단순하고 빠른 브랜치 전략](/posts/github-flow-overview/)

**다음 글:** [Trunk-Based Development: 브랜치 없이 빠르게](/posts/trunk-based-development/)

<br>
읽어주셔서 감사합니다. 😊
