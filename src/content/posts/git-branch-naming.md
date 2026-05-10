---
title: "브랜치 네이밍 컨벤션: 팀이 합의해야 할 규칙들"
description: "feature/fix/hotfix/release 접두사 패턴부터 이슈 번호 연동, 특수문자 제약, Git hook으로 자동 검증하는 방법까지 브랜치 네이밍 컨벤션을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "브랜치 네이밍", "컨벤션", "feature branch", "깃 워크플로"]
featured: false
draft: false
---

[지난 글](/posts/git-branch-tracking/)에서 추적 브랜치의 원리를 살펴봤다. 이번에는 팀 전체가 합의해야 할 브랜치 네이밍 규칙을 정리한다. 브랜치 이름은 단순한 레이블이 아니라, 코드 리뷰·CI/CD·이슈 트래킹의 연결 고리가 된다.

## 기본 패턴: 타입/설명

가장 널리 쓰이는 구조는 `<타입>/<설명>` 형태다.

```
feature/user-auth
fix/login-null-pointer
hotfix/payment-crash
release/v2.1.0
chore/upgrade-vite-5
refactor/auth-service
docs/api-guide
```

슬래시(`/`)는 많은 Git GUI 도구에서 폴더로 시각화되어 목록을 정리해준다.

![브랜치 네이밍 패턴](/assets/posts/git-branch-naming-patterns.svg)

## 타입별 의미

| 타입 | 용도 |
|------|------|
| `feature/` | 새 기능 개발 |
| `fix/` | 버그 수정 (일반) |
| `hotfix/` | 프로덕션 긴급 수정 |
| `release/` | 릴리스 준비 브랜치 |
| `chore/` | 빌드·의존성·설정 변경 |
| `refactor/` | 기능 변경 없는 코드 개선 |
| `docs/` | 문서 작업 |
| `test/` | 테스트 추가·수정 |

## 이슈 번호 연동

GitHub·Jira·Linear 이슈 번호를 브랜치 이름에 포함하면 PR에서 이슈가 자동 연결된다.

```bash
# GitHub issue #123
git switch -c feature/GH-123-user-auth

# Jira ticket
git switch -c fix/PROJ-456-payment-timeout
```

GitHub는 브랜치 이름이나 커밋 메시지에 `#123`이 있으면 이슈를 자동으로 참조한다.

## Good vs Bad 예시

![Good vs Bad 브랜치 이름](/assets/posts/git-branch-naming-bad-good.svg)

## 기술적 제약

Git 브랜치 이름에 사용할 수 없는 문자들이 있다.

```bash
# 금지된 문자·패턴
~  ^  :  ?  *  \  ..  @{  공백  한글(권장하지 않음)

# 확인
git check-ref-format --branch "feature/my feature"
# → fatal: 'feature/my feature' is not a valid branch name
```

소문자 영숫자와 하이픈(`-`), 슬래시(`/`)만 쓰는 것이 가장 안전하다.

## Git hook으로 자동 검증

팀 규칙을 강제하려면 `commit-msg` 또는 `pre-push` hook에서 브랜치 이름을 검사한다.

```bash
# .git/hooks/pre-push (실행 권한 필요)
#!/bin/sh
branch=$(git symbolic-ref --short HEAD)
pattern='^(feature|fix|hotfix|release|chore|refactor|docs|test)/.+'

if ! echo "$branch" | grep -qE "$pattern"; then
  echo "❌ 브랜치 이름이 규칙에 맞지 않습니다: $branch"
  echo "   허용 형식: feature/설명, fix/설명, hotfix/설명, ..."
  exit 1
fi
```

## 주의: `main`·`master` 예약 이름

프로젝트의 기본 브랜치 이름은 팀 전체가 합의해야 한다. GitHub는 기본값으로 `main`을 사용하며, 직접 push를 금지하는 보호 규칙을 함께 설정하는 것이 권장된다.

```bash
# 현재 기본 브랜치 이름 확인
git config --global init.defaultBranch
```

---

**지난 글:** [추적 브랜치(Tracking Branch): 로컬과 원격의 연결 고리](/posts/git-branch-tracking/)

**다음 글:** [git checkout vs git switch: 브랜치 전환 명령 비교](/posts/git-checkout-vs-switch/)

<br>
읽어주셔서 감사합니다. 😊
