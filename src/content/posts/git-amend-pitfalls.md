---
title: "git commit --amend 주의사항과 실수 복구"
description: "공유 브랜치 amend의 위험성, force push 후 팀원 히스토리 충돌 원인, reflog를 사용한 amend 복구 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "amend", "force push", "reflog", "히스토리 재작성", "주의사항"]
featured: false
draft: false
---

[지난 글](/posts/git-amend/)에서 `git commit --amend`의 기본 사용법을 살펴봤다. 이번에는 **amend가 야기하는 문제와 안전한 사용 기준**, 그리고 실수를 저질렀을 때 복구하는 방법을 다룬다.

## 왜 공유 브랜치 amend가 위험한가

amend는 새 커밋 객체를 만들고 SHA를 바꾼다. 이미 팀원이 그 커밋을 pull해서 위에 작업을 쌓았다면, 같은 내용이지만 SHA가 다른 커밋이 두 군데 공존하게 된다.

```bash
# 팀원 A: 이미 pull해서 커밋 C를 만들었음
# A → B(def5678) → C

# 나: B를 amend해서 B'(ghi9012)를 만들고 force push
# A → B'(ghi9012)    ← main이 이쪽을 가리킴

# 팀원 A가 git pull하면
# A → B' → B(def5678) → C  ← B가 두 번 나타나는 혼란
```

팀원 입장에서는 자신이 작업한 커밋 C의 부모(B)가 원격에서 사라졌기 때문에, `git pull`이 복잡한 merge를 유발하거나 팀원의 커밋 C가 분리된 히스토리에 고립될 수 있다.

![공유 브랜치 amend 위험성](/assets/posts/git-amend-pitfalls-diagram.svg)

## force push의 두 가지 옵션

amend 후 원격에 올리려면 force push가 필요하다.

```bash
# 위험: 원격 상태를 무조건 덮어씀
git push --force origin main

# 더 안전: 원격이 내 예상과 다르면 거부
git push --force-with-lease origin main
```

`--force-with-lease`는 내가 마지막으로 fetch한 시점 이후 원격이 바뀌었으면(누군가 push했으면) push를 거부한다. 팀원의 커밋을 실수로 덮어쓰는 것을 방지한다. 그러나 이것도 팀원이 이미 pull한 상황은 해결하지 못한다.

## amend 실수 복구 — reflog

amend 전 상태는 reflog에 남아있다. 30일(기본값) 안에는 복구할 수 있다.

```bash
# reflog 확인
git reflog
# ghi9012 HEAD@{0}: commit (amend): feat: add login
# def5678 HEAD@{1}: commit: feat: add loginn  ← amend 이전 원본

# amend 이전으로 되돌리기
git reset --hard HEAD@{1}
```

`HEAD@{1}`이 amend 직전의 커밋이다. `reset --hard`로 그 커밋으로 돌아가면 amend 이전 상태가 완전히 복구된다.

```bash
# 특정 커밋 SHA로 복구
git reset --hard def5678

# 작업 디렉터리를 건드리지 않고 HEAD만 이동
git reset --soft HEAD@{1}
```

## 실수 시나리오별 대응

**시나리오 1**: 혼자만 쓰는 브랜치에 amend + force push

```bash
# 문제 없음. 단, --force-with-lease 사용 권장
git commit --amend --no-edit
git push --force-with-lease origin feature/my-branch
```

**시나리오 2**: 공유 브랜치에 실수로 amend + force push

```bash
# 팀원들에게 즉시 공지
# 팀원들은 아래 명령으로 복구:
git fetch origin
git reset --hard origin/main   # 원격 상태로 강제 동기화
# (주의: 팀원의 로컬 커밋이 있으면 스태시 또는 별도 브랜치로 보존 필요)
```

**시나리오 3**: amend를 너무 많이 해서 원점 찾기 어려울 때

```bash
# reflog의 날짜 기반 검색
git reflog --date=iso | grep "2026-05-19"
# 특정 시점의 HEAD 상태를 SHA로 확인
```

![amend 안전 사용 원칙](/assets/posts/git-amend-pitfalls-rules.svg)

## amend 대신 쓸 수 있는 대안

공유 브랜치에서 실수를 수정해야 할 때는 amend 대신 **새 커밋**을 추가한다.

```bash
# 메시지 실수 → 새 커밋에 설명 추가 (또는 그냥 넘어가기)
# 빠뜨린 파일 → 별도 커밋으로 추가
git add forgotten-file.js
git commit -m "fix: add missing config file"

# 코드 실수 → revert 또는 fixup 커밋
git commit -m "fix: correct login endpoint url"
```

히스토리를 깔끔하게 유지하고 싶다면 나중에 `git rebase -i`로 squash/fixup하면 된다. 이 방법은 SHA를 바꾸지만, main에 merge 전 feature 브랜치 안에서 하는 것이기 때문에 팀원에게 영향이 없다.

## amend와 GPG 서명

GPG 서명된 커밋을 amend하면 서명이 무효화된다. 새 SHA에 다시 서명이 필요하다.

```bash
# 서명 포함 amend
git commit --amend --no-edit -S

# 서명 확인
git log --show-signature -1
```

서명이 설정된 환경에서는 `commit.gpgsign = true` 설정이 있으면 amend 시 자동으로 재서명된다.

---

**지난 글:** [git commit --amend — 마지막 커밋 수정](/posts/git-amend/)

**다음 글:** [git rebase -i — squash와 fixup으로 히스토리 정리](/posts/git-rebase-squash-fixup/)

<br>
읽어주셔서 감사합니다. 😊
