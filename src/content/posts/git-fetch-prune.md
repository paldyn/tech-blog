---
title: "fetch --prune으로 삭제된 원격 브랜치 정리하기"
description: "git fetch --prune 옵션으로 이미 삭제된 원격 브랜치의 로컬 추적 레퍼런스를 정리하는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "fetch", "prune", "원격 브랜치", "추적 브랜치"]
featured: false
draft: false
---

[지난 글](/posts/git-fetch-vs-pull/)에서 fetch와 pull의 차이를 살펴봤다. 활발한 협업 환경에서는 원격에 수십 개의 브랜치가 생성·삭제된다. 팀원이 PR을 머지한 뒤 원격 브랜치를 삭제해도, **로컬의 추적 브랜치(`origin/feature/...`)는 자동으로 사라지지 않는다**. 이 "유령 브랜치"가 쌓이면 `git branch -r` 목록이 지저분해지고, 이미 사라진 브랜치로 착각하여 작업을 이어가는 실수도 생긴다. `git fetch --prune`이 이 문제를 해결한다.

## 문제: 유령 추적 브랜치

`git fetch`는 기본적으로 **새 브랜치를 추가**하는 방향으로만 동작한다. 원격에서 삭제된 브랜치를 로컬에서 자동으로 제거하지 않는다.

```bash
# 팀원이 이미 삭제한 브랜치들이 로컬에 남아 있음
git branch -r
# origin/main
# origin/develop
# origin/feature/old-login    ← 원격에 없음 (stale)
# origin/feature/old-signup   ← 원격에 없음 (stale)
# origin/hotfix/patch-v1
```

이처럼 `origin/feature/old-*` 같은 브랜치는 원격에서는 이미 삭제됐지만 로컬 추적 참조만 남아 있는 "stale" 상태다.

## 해결책: git fetch --prune

```bash
# 특정 원격의 stale 브랜치 정리 + 최신 상태 가져오기
git fetch --prune origin

# 모든 원격 대상
git fetch --prune --all

# 브랜치 삭제 없이 stale만 확인 (실제 삭제 안 함)
git remote prune --dry-run origin
```

![fetch --prune 전후 브랜치 목록](/assets/posts/git-fetch-prune-before-after.svg)

`--prune` 옵션을 붙이면 원격에 더 이상 존재하지 않는 브랜치에 해당하는 `refs/remotes/origin/*` 레퍼런스를 삭제한다. 실제 로컬 브랜치(`git branch`로 보이는 것들)는 영향을 받지 않는다.

## 자동화: 항상 --prune 적용

매번 `--prune`을 타이핑하기 번거롭다면 전역 설정으로 자동화할 수 있다.

```bash
# 이후 모든 git fetch에 --prune 자동 적용
git config --global fetch.prune true

# 태그의 stale도 함께 정리
git config --global fetch.pruneTags true
```

설정 후에는 `git fetch origin`만 실행해도 자동으로 정리가 이뤄진다.

![fetch --prune 명령과 설정](/assets/posts/git-fetch-prune-commands.svg)

## git remote prune 명령

`git fetch --prune` 외에 `git remote prune`도 동일한 역할을 한다.

```bash
# 삭제할 대상 미리 확인
git remote prune --dry-run origin

# 실제 stale 추적 브랜치 삭제
git remote prune origin
```

`git remote prune`은 원격에서 새 데이터를 가져오지 **않고** stale 삭제만 수행한다는 점이 `git fetch --prune`과 다르다. 네트워크 오버헤드를 최소화하면서 정리만 하고 싶을 때 유용하다.

## 로컬 브랜치의 [gone] 상태 정리

추적 브랜치가 삭제되면 해당 로컬 브랜치에 `[gone]` 표시가 생긴다.

```bash
git branch -vv
# feature/old-login  abc1234 [origin/feature/old-login: gone] fix login
# feature/payment    def5678 [origin/feature/payment] add payment
```

`[gone]` 브랜치는 더 이상 원격과 연결되지 않은 로컬 브랜치다. 작업이 완료됐다면 삭제한다.

```bash
# gone 브랜치 한 번에 찾아 삭제 (shell 예시)
git branch -vv | grep '\[gone\]' | awk '{print $1}' | xargs git branch -d
```

머지되지 않은 커밋이 있는 브랜치는 `-d` 대신 `-D`를 써야 강제 삭제된다. 중요한 작업이 있다면 삭제 전에 반드시 확인한다.

## pull과의 결합

`git pull --prune`도 동작한다. pull 시 fetch + prune + merge를 한 번에 처리한다.

```bash
git pull --prune origin main
```

그러나 pull 자체가 자동 통합을 포함하므로, 내용 확인이 필요한 환경에서는 `git fetch --prune` 후 별도로 통합하는 방식이 더 안전하다.

## 정리

`git fetch --prune`(또는 전역 `fetch.prune = true` 설정)을 도입하면 팀에서 삭제한 원격 브랜치가 로컬에 유령처럼 남는 문제를 자동으로 해결할 수 있다. 규모가 큰 프로젝트일수록 stale 브랜치가 빠르게 쌓이므로, 처음부터 자동화 설정을 켜두는 것이 좋다.

---

**지난 글:** [fetch와 pull의 차이 — 안전하게 동기화하기](/posts/git-fetch-vs-pull/)

**다음 글:** [pull --rebase — 깔끔한 히스토리 유지하기](/posts/git-pull-rebase/)

<br>
읽어주셔서 감사합니다. 😊
