---
title: "push --force-with-lease — 안전한 강제 푸시"
description: "git push --force-with-lease 옵션이 --force보다 안전한 이유와 동작 방식, 실용적인 사용법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "push", "force-with-lease", "force push", "안전한 rebase"]
featured: false
draft: false
---

[지난 글](/posts/git-push-force/)에서 `git push --force`의 위험성을 살펴봤다. force push가 필요한 상황은 분명히 존재한다. 리베이스 후 피처 브랜치를 정리할 때, 실수한 커밋을 수정할 때가 그렇다. 이때 `--force`의 위험을 줄이면서 동일한 목적을 달성하는 옵션이 `--force-with-lease`다.

## --force와 --force-with-lease의 차이

`--force`는 원격의 현재 상태를 **전혀 확인하지 않고** 무조건 덮어쓴다. `--force-with-lease`는 로컬이 기억하는 원격 브랜치의 SHA와 **실제 원격의 현재 SHA를 비교**한다. 두 값이 다르면 push를 거부한다.

```bash
# 안전하지 않음: 원격 상태 무시
git push --force origin main

# 안전함: 원격 상태 확인 후 force
git push --force-with-lease origin main
```

![force-with-lease 안전 메커니즘](/assets/posts/git-push-force-with-lease-safety.svg)

**"lease(임대)"의 의미**: 내가 마지막으로 fetch했을 때 원격 브랜치가 특정 SHA였다면, 그 SHA를 "임대"하고 있다고 본다. Push 시점에 원격이 여전히 그 SHA를 가리키고 있으면 내가 임대한 상태가 유효하므로 push를 허용한다. 원격이 다른 SHA(팀원이 새 커밋을 올린 경우)를 가리키면 임대가 무효화되어 push를 거부한다.

## 동작 원리: refs/remotes 기준

`--force-with-lease`가 비교하는 값은 로컬의 `refs/remotes/origin/main`이다. 이 값은 `git fetch`를 실행할 때 갱신된다.

```bash
# 로컬 추적 브랜치 현재 SHA 확인
git rev-parse origin/main
# abc1234def5678

# 실제 원격 최신 SHA 확인
git ls-remote origin refs/heads/main
# def5678abc1234  refs/heads/main

# 다르면 --force-with-lease 도 거부됨
git push --force-with-lease origin main
# ! [rejected] (stale info)
```

따라서 `git fetch` 없이 오랫동안 작업한 뒤 push하면 로컬 추적 값이 오래된 상태라 팀원의 새 커밋을 "모르는" 상태가 된다. 이 경우 `--force-with-lease`도 잘못된 안도감을 줄 수 있다. **push 직전에 `git fetch`를 실행**하는 것이 가장 안전하다.

## 실제 사용 패턴

```bash
# 피처 브랜치 rebase 후 force push (올바른 방법)
git rebase -i main
git push --force-with-lease origin feature/user-auth
```

팀원이 내 피처 브랜치에 직접 커밋을 추가한 경우, `--force-with-lease`가 그 커밋을 감지하고 push를 거부한다. 팀원의 변경을 의도치 않게 지우는 사고를 방지한다.

![force-with-lease 명령 모음](/assets/posts/git-push-force-with-lease-commands.svg)

## alias 설정으로 편리하게

`--force-with-lease`는 타이핑이 길어 불편하다. alias로 줄이는 것이 좋다.

```bash
# 전역 alias 설정
git config --global alias.pushf 'push --force-with-lease'

# 이후 사용
git pushf origin feature/my-work

# 더 짧게: --force-if-includes 결합 (Git 2.30+)
git push --force-with-lease --force-if-includes origin main
```

`--force-if-includes`는 `--force-with-lease`를 보완하는 추가 안전장치다. 원격의 변경 사항을 실제로 로컬 히스토리에 통합(rebase/merge)했을 때만 force push를 허용한다.

## lease 범위 제한

특정 브랜치에만 lease를 적용하거나 특정 SHA를 직접 지정할 수 있다.

```bash
# main에 대해서만 lease 적용
git push --force-with-lease=main origin main

# 특정 SHA를 기대값으로 지정
git push --force-with-lease=main:abc1234 origin main
```

복잡한 CI/CD 자동화에서 정확한 SHA를 검증할 때 유용하다.

## --force-with-lease를 우회하는 상황

`--force-with-lease`에도 한계가 있다. `git fetch`를 실행하면 로컬 추적 브랜치가 갱신되므로, fetch 후에는 팀원의 새 커밋을 "알게" 된다. 이 상태에서 `--force-with-lease`를 실행하면 push가 허용되어 팀원 커밋을 덮어쓸 수 있다.

```bash
# 이 순서는 --force-with-lease를 사실상 --force처럼 만듦
git fetch origin
git push --force-with-lease origin main  # 팀원 커밋 덮어씀!
```

따라서 `--force-with-lease`도 **피처 브랜치 한정**으로 사용하는 원칙은 여전히 중요하다. 공유 브랜치에서는 추가 보호 설정이 필요하다.

## 정리

`--force-with-lease`는 `--force`보다 안전하지만 만능은 아니다. force push가 필요한 상황이라면 항상 `--force-with-lease`를 선택하고, push 직전 `git fetch`로 최신 상태를 확인하는 습관을 들인다. 공유 브랜치(main, develop)에는 GitHub branch protection으로 force push 자체를 차단하는 것이 근본적인 해결책이다.

---

**지난 글:** [git push --force의 위험성과 주의사항](/posts/git-push-force/)

**다음 글:** [태그 push — 로컬 태그를 원격에 올리기](/posts/git-push-tags/)

<br>
읽어주셔서 감사합니다. 😊
