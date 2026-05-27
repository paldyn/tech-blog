---
title: "GitHub Flow: 단순하고 빠른 브랜치 전략"
description: "GitHub Flow의 6단계 주기(브랜치 생성, 커밋, PR 오픈, 리뷰, 배포, 머지), main 브랜치 항상 배포 가능 원칙, Gitflow와의 비교, 지속적 배포 환경에서의 적합성을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub Flow", "브랜치전략", "PR", "지속적배포", "워크플로우"]
featured: false
draft: false
---

[지난 글](/posts/gitflow-release-hotfix/)에서 Gitflow의 release와 hotfix 브랜치를 다뤘다. Gitflow는 강력하지만 복잡하다. **GitHub Flow**는 Scott Chacon이 2011년에 제안한 훨씬 단순한 브랜치 전략으로, 하루에도 여러 번 배포하는 팀에 적합하다.

## GitHub Flow의 핵심

GitHub Flow의 핵심 원칙은 두 가지다.

1. **main 브랜치는 항상 배포 가능한 상태**를 유지한다
2. 새 작업은 모두 **main에서 직접 분기한** topic 브랜치에서 시작한다

develop 브랜치가 없다. main에서 바로 분기하고, PR을 통해 main으로 직접 머지한다.

## 6단계 주기

```
main → 브랜치 생성 → 커밋 → PR 오픈 → 리뷰/CI → 머지 → 배포
```

### ① 브랜치 생성

```bash
git checkout main
git pull origin main
git checkout -b feature/add-search
```

브랜치 이름은 작업 내용을 명확하게 표현한다. Gitflow처럼 `feature/` 접두사를 강제하지 않아도 되지만, 팀 컨벤션을 정하면 좋다.

### ② 커밋

```bash
git add src/search/
git commit -m "feat(search): 엘라스틱서치 연동 검색 API 추가"

git add tests/
git commit -m "test(search): 검색 결과 페이지네이션 단위 테스트"
```

작은 단위로 자주 커밋한다. 커밋이 쌓이면 작업 진행 상황을 PR에서 확인할 수 있다.

### ③ PR 오픈

작업 완료 전이라도 **Draft PR**로 일찍 오픈한다. 리뷰어에게 방향을 공유하고 이른 피드백을 받을 수 있다.

```bash
git push -u origin feature/add-search
# GitHub에서 PR 생성
```

PR 템플릿에 변경 내용, 테스트 방법, 스크린샷 등을 기술한다.

![GitHub Flow 전체 주기](/assets/posts/github-flow-overview-flow.svg)

### ④ 리뷰와 CI

팀원이 코드를 리뷰하고 Approve한다. GitHub Actions 같은 CI 파이프라인이 자동으로 테스트를 실행한다. 두 조건(Approve + CI 통과)을 만족해야 머지 버튼이 활성화된다.

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm test
```

### ⑤ 머지

```bash
# GitHub UI에서 Squash and merge / Merge commit 선택
# 또는 CLI
gh pr merge 42 --squash
```

머지 방식(merge commit, squash, rebase)은 팀 정책에 따라 선택한다.

### ⑥ 배포

머지 직후 main에 CD 파이프라인이 자동으로 트리거된다.

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/deploy.sh production
```

## GitHub Flow vs Gitflow

![GitHub Flow vs Gitflow 비교](/assets/posts/github-flow-overview-vs-gitflow.svg)

GitHub Flow는 `main` 하나만 관리하기 때문에 Gitflow보다 훨씬 단순하다. 대신 main이 항상 배포 가능한 상태임을 보장하는 **CI/CD 자동화**가 필수다.

## 환경별 배포 분리

CD가 main 머지 즉시 프로덕션으로 배포하면 리스크가 있다. 환경 분리 전략 중 하나는 **tag 기반 배포**다.

```bash
# main 최신 커밋에 태그를 붙여서 배포 트리거
git tag v2024.05.28 -m "릴리즈"
git push origin v2024.05.28
```

또는 GitHub Environments로 staging → production 순서를 강제할 수도 있다.

## GitHub Flow가 적합한 경우

- 웹 서비스·SaaS — 하루에 여러 번 배포
- 소규모~중규모 팀
- 단일 버전만 유지해도 되는 제품
- CI/CD 파이프라인이 잘 구축된 환경

여러 버전을 동시에 유지보수해야 하거나 릴리즈 일정이 외부에 의해 고정되는 경우에는 Gitflow가 더 적합하다.

---

**지난 글:** [Gitflow release와 hotfix 브랜치](/posts/gitflow-release-hotfix/)

<br>
읽어주셔서 감사합니다. 😊
