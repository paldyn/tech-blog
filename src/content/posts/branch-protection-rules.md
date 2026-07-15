---
title: "Branch Protection Rules: 실수 방지 안전망"
description: "GitHub Branch Protection Rules와 Repository Rulesets의 주요 옵션(PR 필수화, CI 체크, Approve 수, 서명 커밋), 브랜치 패턴 매칭, bypass 설정, GitHub CLI로 자동화하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "BranchProtection", "CI", "코드리뷰", "보안"]
featured: false
draft: false
---

[지난 글](/posts/monorepo-vs-polyrepo/)에서 저장소 구조를 다뤘다. 어떤 구조를 쓰든 `main`이나 `release/*` 같은 중요 브랜치에 실수로 직접 push하거나, 리뷰 없이 코드가 올라가는 일을 막아야 한다. GitHub의 **Branch Protection Rules**와 **Repository Rulesets**이 그 역할을 한다.

## Branch Protection vs Repository Rulesets

GitHub에는 두 가지 보호 메커니즘이 있다.

- **Branch Protection Rules** (구): 저장소 Settings → Branches에서 설정. 브랜치별 개별 설정
- **Repository Rulesets** (신): 더 유연한 패턴 매칭, 조직 수준 적용, bypass 목록 관리 가능

신규 프로젝트라면 Repository Rulesets를 사용하는 것이 권장된다. 기능은 같고 Rulesets가 더 유연하다.

## 주요 옵션

![Branch Protection Rules 주요 옵션](/assets/posts/branch-protection-rules-settings.svg)

### Require a pull request before merging

가장 기본적인 규칙이다. 활성화하면 `main`에 직접 `git push`가 차단된다.

```bash
# 이 push는 차단됨
git push origin main
# remote: error: GH006: Protected branch update failed for refs/heads/main.
# remote: error: Changes must be made through a pull request.
```

### Require status checks to pass

PR이 머지되려면 지정한 CI 체크가 통과해야 한다. GitHub Actions 워크플로우 이름이나 외부 CI 체크 이름을 입력한다.

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
```

체크 이름 `CI / test`를 Required status checks에 등록하면 이 체크가 통과해야만 머지 버튼이 활성화된다.

### Required approvals

최소 Approve 수를 설정한다. 1~6명까지 지정 가능. 팀 규모에 따라 1~2명이 적절하다.

**Dismiss stale pull request approvals when new commits are pushed** 옵션도 함께 켜두는 것이 좋다. Approve 후 새 커밋이 추가되면 기존 Approve가 무효화되어 재검토를 강제한다.

### Require branches to be up to date

PR 브랜치가 base 브랜치보다 오래되면 머지를 차단한다. race condition으로 인한 "머지 직전 충돌 + main 깨짐" 상황을 방지한다.

## 브랜치 패턴 설정

![브랜치 패턴 예시](/assets/posts/branch-protection-rules-patterns.svg)

하나의 규칙을 여러 브랜치에 적용할 때 패턴을 사용한다.

```text
main           # main 브랜치 정확 매칭
release/*      # release/1.0, release/2.x 등
v[0-9]*        # v1, v2.0 등 버전 태그/브랜치
**             # 모든 브랜치 (Repository Rules 전용)
```

## Bypass 설정

관리자가 긴급 상황에서 규칙을 우회할 수 있도록 bypass 목록을 관리한다.

```bash
# CODEOWNERS와 함께 쓸 때
# .github/CODEOWNERS
/src/payments/  @payments-team

# 결제팀만 payments 디렉토리 리뷰 담당
# Branch Protection의 "Require review from Code Owners" 옵션과 연동
```

## 실전 권장 설정 (main 브랜치)

```text
✓ Require a pull request before merging
  ✓ Required approvals: 1
  ✓ Dismiss stale pull request approvals when new commits are pushed
  ✓ Require review from Code Owners (CODEOWNERS 파일 운영 시)
✓ Require status checks to pass before merging
  ✓ Require branches to be up to date before merging
  [CI 체크 이름 등록]
✓ Do not allow bypassing the above settings (선택적)
```

프로덕션에 배포되는 브랜치에는 위 설정을 모두 켜고, 개발/스테이징 브랜치에는 완화된 규칙을 적용하는 것이 일반적이다.

---

**지난 글:** [Monorepo vs Polyrepo: 어떤 저장소 구조를 선택할까](/posts/monorepo-vs-polyrepo/)

**다음 글:** [코드 리뷰 흐름: PR에서 머지까지](/posts/code-review-flow/)

<br>
읽어주셔서 감사합니다. 😊
