---
title: "태그 삭제 — 로컬과 원격"
description: "git tag -d, git push --delete로 로컬·원격 태그를 삭제하는 방법과 팀 환경에서 안전하게 처리하는 패턴을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "tag", "tag -d", "push --delete", "태그 삭제"]
featured: false
draft: false
---

[지난 글](/posts/git-tag-push-fetch/)에서 태그를 원격에 push하고 fetch하는 방법을 정리했다. 이번에는 **잘못 만든 태그를 삭제**하는 방법을 다룬다. 로컬 삭제와 원격 삭제는 별도 명령이고, 팀 환경에서는 팀원의 로컬 정리까지 신경 써야 한다.

## 로컬 태그 삭제

```bash
# 단일 태그 삭제
git tag -d v1.0.0

# 여러 태그 한 번에
git tag -d v1.0.0 v1.0.1 v1.1.0

# 패턴으로 삭제
git tag -l "test-*" | xargs git tag -d
```

`-d`는 `.git/refs/tags/` 아래의 파일만 제거한다. 해당 태그가 가리키던 커밋 객체는 영향받지 않는다.

![태그 삭제 절차](/assets/posts/git-tag-delete-flow.svg)

## 원격 태그 삭제

```bash
# --delete 방식 (Git 1.7.0+)
git push origin --delete v1.0.0

# 여러 태그 한 번에
git push origin --delete v1.0.0 v1.0.1

# 옛 refspec 방식 (Git 구버전 호환)
git push origin :refs/tags/v1.0.0
```

두 방식은 같은 결과를 낸다. `--delete`가 더 읽기 쉽고 실수 가능성이 낮다.

## 팀 환경에서 안전한 삭제

원격에서 태그를 삭제해도 다른 팀원의 로컬에는 태그가 그대로 남아있다. 팀원들이 직접 정리하거나, `--prune-tags` 옵션으로 자동 정리하도록 안내한다.

```bash
# 원격에 없는 태그 자동 제거
git fetch --prune-tags origin

# 또는 설정으로 항상 prune
git config --global fetch.pruneTags true
```

`fetch.pruneTags true`를 설정하면 `git fetch` 때마다 원격에 없어진 태그를 로컬에서 자동으로 제거한다.

![태그 삭제 시나리오](/assets/posts/git-tag-delete-scenarios.svg)

## 잘못된 커밋에 붙인 태그 수정

태그를 삭제하고 올바른 커밋에 다시 붙이는 흐름이다.

```bash
# 1. 잘못된 태그 삭제 (로컬 + 원격)
git tag -d v1.0.0
git push origin --delete v1.0.0

# 2. 올바른 커밋에 다시 생성
git tag -a v1.0.0 correct-commit-sha -m "Release v1.0.0"

# 3. 원격에 push
git push origin v1.0.0
```

팀원들은 `git fetch --prune-tags` 후 `git fetch --tags`로 새 태그를 받는다.

## GitHub Releases와의 관계

GitHub에서 태그에 릴리스를 연결했다면, 태그 삭제 시 릴리스도 함께 삭제된다. GitHub UI에서는 릴리스를 먼저 삭제한 후 태그를 삭제하는 것이 권장된다.

```bash
# GitHub CLI로 릴리스 삭제
gh release delete v1.0.0 --yes

# 이후 태그 삭제
git tag -d v1.0.0
git push origin --delete v1.0.0
```

릴리스가 연결된 태그는 Git 명령으로 삭제해도 GitHub UI에서 고아 릴리스가 남을 수 있다. GitHub CLI나 웹 UI에서 명시적으로 처리하는 게 안전하다.

## 태그 강제 이동 (삭제 없이)

태그를 삭제하지 않고 다른 커밋으로 옮기고 싶을 때는 `-f`(force)를 쓴다.

```bash
# 로컬에서 강제 이동
git tag -f v1.0.0 correct-sha

# 원격에 강제 push
git push origin -f v1.0.0
```

원격에 이미 push된 태그를 `-f`로 덮어쓰면 다른 팀원의 로컬과 불일치가 발생한다. 공유된 태그에는 사용하지 않는 것이 원칙이다.

---

**지난 글:** [태그 Push와 Fetch — 원격 동기화](/posts/git-tag-push-fetch/)

**다음 글:** [git describe — 버전 자동 생성](/posts/git-describe/)

<br>
읽어주셔서 감사합니다. 😊
