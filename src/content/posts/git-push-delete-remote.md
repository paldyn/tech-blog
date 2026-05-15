---
title: "원격 브랜치와 태그 삭제하기"
description: "git push origin --delete 명령어로 원격 브랜치나 태그를 안전하게 삭제하는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "push", "delete", "원격 브랜치 삭제", "원격 태그 삭제"]
featured: false
draft: false
---

[지난 글](/posts/git-push-tags/)에서 로컬 태그를 원격에 올리는 방법을 살펴봤다. PR이 머지되면 피처 브랜치는 원격에서 제거하는 것이 일반적인 관례다. 오래된 브랜치가 쌓이면 저장소가 지저분해지고, `git branch -r` 목록이 수십 개로 불어나 혼란을 준다. 이번 글에서는 원격 브랜치와 태그를 안전하게 삭제하는 방법을 다룬다.

## 원격 브랜치 삭제: --delete 옵션

```bash
# 기본 문법 (Git 1.7+, 권장)
git push origin --delete feature/user-auth

# 단축형
git push origin -d feature/user-auth
```

`--delete` 옵션은 원격 저장소에서 해당 브랜치를 제거한다. **로컬 브랜치는 건드리지 않는다**는 점이 중요하다. 로컬 `feature/user-auth`는 그대로 남아 있으므로 별도로 삭제해야 한다.

## 구형 문법: 콜론(:) 앞 빈 값

Git 1.7 이전에는 `--delete` 옵션이 없었기 때문에 다음 문법을 사용했다.

```bash
# "빈 ref를 원격에 push" = 삭제
git push origin :feature/user-auth
```

`<로컬>:<원격>` 형식에서 로컬 부분을 비워두면 원격 브랜치를 빈 값으로 교체한다는 의미, 즉 삭제다. 구형 서버 호환성이 필요한 경우 외에는 `--delete` 문법이 더 명확하다.

![원격 브랜치 삭제 두 가지 문법](/assets/posts/git-push-delete-remote-methods.svg)

## 삭제 후 로컬 정리

원격 브랜치를 삭제하면 로컬의 추적 브랜치(`origin/feature/user-auth`)도 정리가 필요하다.

```bash
# 방법 1: fetch --prune으로 자동 정리
git fetch --prune

# 방법 2: 수동 삭제
git branch -dr origin/feature/user-auth
```

로컬 브랜치도 삭제하려면:

```bash
# 머지된 경우 (-d)
git branch -d feature/user-auth

# 머지 여부 관계없이 강제 삭제 (-D)
git branch -D feature/user-auth
```

## 전체 삭제 플로우 예시

PR이 머지된 후 브랜치를 완전히 정리하는 전형적인 플로우다.

```bash
# 1. main으로 전환 및 최신 상태 반영
git switch main
git pull origin main

# 2. 원격 피처 브랜치 삭제
git push origin --delete feature/user-auth

# 3. 로컬 추적 브랜치 정리
git fetch --prune

# 4. 로컬 브랜치 삭제
git branch -d feature/user-auth
```

GitHub에서 PR을 머지할 때 "Delete branch" 버튼을 클릭하면 2번이 자동으로 처리된다. 이후 로컬에서 3번과 4번을 실행하면 된다.

## 원격 태그 삭제

```bash
# 원격 태그 삭제
git push origin --delete v1.0.0-beta

# 콜론 문법으로도 동일
git push origin :refs/tags/v1.0.0-beta

# 로컬 태그도 삭제
git tag -d v1.0.0-beta
```

원격 태그를 삭제할 때는 신중해야 한다. 이미 배포에 사용됐거나 다른 사람이 참조하고 있는 태그를 삭제하면 혼란이 생긴다. `beta`, `rc`, `pre` 같은 사전 릴리스 태그처럼 정정이 필요한 경우에만 삭제한다.

![원격 브랜치·태그 삭제 명령 모음](/assets/posts/git-push-delete-remote-commands.svg)

## 여러 브랜치 한꺼번에 삭제

```bash
# 여러 브랜치를 한 번에 삭제
git push origin --delete feature/a feature/b feature/c

# 특정 패턴의 브랜치 일괄 삭제 (shell 활용)
git branch -r | grep 'origin/feature/old-' \
  | sed 's/origin\///' \
  | xargs -I{} git push origin --delete {}
```

일괄 삭제는 강력한 만큼 신중하게 사용한다. `--dry-run` 옵션이 없으므로, 삭제 대상을 먼저 출력해서 확인한 뒤 실행한다.

## 삭제 보호: 브랜치 보호 규칙

중요한 브랜치가 실수로 삭제되는 것을 막으려면 GitHub의 branch protection 설정을 활용한다.

```
GitHub: Settings → Branches → Branch protection rules
→ "Do not allow deletions"
```

이 설정이 적용된 브랜치는 어떤 사용자도 삭제할 수 없다. `main`, `develop`, `release/*` 같은 장기 브랜치에 적용하는 것이 좋다.

## 실수로 삭제한 브랜치 복구

원격 브랜치를 잘못 삭제했다면 reflog나 기존 커밋 SHA를 통해 복구할 수 있다.

```bash
# 로컬 reflog에서 최신 SHA 확인
git reflog

# 해당 SHA로 새 브랜치 생성
git branch recovered-feature abc1234

# 원격에 재생성
git push origin recovered-feature:feature/user-auth
```

GitHub 기준으로 삭제 후 30일 이내에는 관리자 인터페이스에서도 복원할 수 있다. 삭제된 브랜치의 PR 페이지에서 "Restore branch" 버튼이 나타난다.

## 정리

원격 브랜치 삭제는 `git push origin --delete <브랜치명>`으로 간단하게 수행할 수 있다. 삭제 후에는 `git fetch --prune`으로 로컬 추적 브랜치를 정리하고, 필요하다면 `git branch -d`로 로컬 브랜치도 제거한다. 중요한 브랜치에는 branch protection으로 우발적 삭제를 방지하자.

---

**지난 글:** [태그 push — 로컬 태그를 원격에 올리기](/posts/git-push-tags/)

<br>
읽어주셔서 감사합니다. 😊
