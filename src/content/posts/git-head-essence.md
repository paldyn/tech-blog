---
title: "Git HEAD의 본질: symbolic ref와 detached HEAD"
description: ".git/HEAD 파일이 symbolic ref로 브랜치를 가리키는 방식, detached HEAD 상태의 위험성과 복구 방법, ORIG_HEAD·MERGE_HEAD 등 특수 HEAD 파일을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "HEAD", "symbolic-ref", "detached-HEAD", "ORIG_HEAD", "내부구조"]
featured: false
draft: false
---

[지난 글](/posts/git-refs-internal/)에서 `.git/refs/` 구조를 살펴봤다. 그 모든 ref의 최상위에 **HEAD**가 있다. HEAD는 단순해 보이지만 Git의 모든 작업이 HEAD를 기준으로 이뤄진다.

## HEAD란

HEAD는 `.git/HEAD` 파일이다. **현재 작업 중인 위치**를 나타낸다.

```bash
cat .git/HEAD
# ref: refs/heads/main
```

이처럼 다른 ref를 가리키는 포인터를 **symbolic ref**라고 한다. HEAD → main → commit SHA 순서로 역참조가 이뤄진다.

```bash
# HEAD가 가리키는 실제 commit SHA
git rev-parse HEAD
# abc123def456789...

# HEAD가 가리키는 브랜치 이름
git symbolic-ref HEAD
# refs/heads/main

# 단축형
git symbolic-ref --short HEAD
# main
```

## Attached HEAD vs Detached HEAD

HEAD에는 두 가지 상태가 있다.

![HEAD 상태](/assets/posts/git-head-essence-states.svg)

**Attached HEAD**: `ref: refs/heads/브랜치명` 형태. 브랜치에 연결된 정상 상태다. 새 커밋을 만들면 브랜치 포인터와 HEAD가 함께 앞으로 이동한다.

**Detached HEAD**: SHA를 직접 담은 상태.

```bash
# Detached HEAD 진입 (과거 커밋을 직접 체크아웃)
git checkout abc123def
# HEAD is now at abc123def...

cat .git/HEAD
# abc123def456789...  ← SHA 직접 담김
```

Detached HEAD 상태에서 새 커밋을 만들 수 있지만, 브랜치가 없어 추후 다른 브랜치로 이동하면 그 커밋에 접근할 방법이 없어진다(reflog로만 복구 가능).

## Detached HEAD 발생 원인

```bash
# 1. 과거 커밋 직접 체크아웃
git checkout <commit-sha>

# 2. 태그 체크아웃
git checkout v1.0.0

# 3. 원격 추적 브랜치 체크아웃
git checkout origin/main

# 4. rebase, bisect 진행 중 (내부 동작)
```

## Detached HEAD 복구

```bash
# 방법 1: 기존 브랜치로 복귀
git checkout main

# 방법 2: detached 상태에서 만든 커밋을 새 브랜치로 구제
git checkout -b rescue-branch
# 또는
git switch -c rescue-branch

# 현재 상태 확인
git status
# HEAD detached at abc123def  ← detached 확인
```

![HEAD 명령](/assets/posts/git-head-essence-commands.svg)

## HEAD 상대 표현식

HEAD를 기준으로 상대 위치를 지정할 수 있다.

```bash
# 부모 커밋
git show HEAD~1      # 1단계 위 (HEAD~ 과 동일)
git show HEAD~3      # 3단계 위

# 머지 커밋의 두 번째 부모
git show HEAD^2

# reflog 기반
git show HEAD@{1}    # 직전에 HEAD가 가리켰던 커밋
git show HEAD@{yesterday}

# tree/blob 역참조
git rev-parse HEAD^{tree}
```

## 특수 HEAD 파일들

Git은 특정 작업 중에 `.git/` 아래 추가적인 HEAD 파일을 생성한다.

| 파일 | 생성 시점 | 내용 |
|------|-----------|------|
| `ORIG_HEAD` | merge·rebase·reset 전 | 이전 HEAD SHA |
| `MERGE_HEAD` | merge 진행 중 | 병합되는 쪽 커밋 SHA |
| `CHERRY_PICK_HEAD` | cherry-pick 진행 중 | 적용 중인 커밋 SHA |
| `REBASE_HEAD` | rebase 진행 중 | 현재 적용 중인 커밋 SHA |

```bash
# merge 중 상태 확인
cat .git/MERGE_HEAD

# ORIG_HEAD를 이용한 merge 취소
git reset --hard ORIG_HEAD

# cherry-pick 중단
git cherry-pick --abort
```

`ORIG_HEAD`는 위험한 작업 전 자동 백업점이다. merge나 rebase가 잘못되었을 때 `git reset --hard ORIG_HEAD`로 되돌릴 수 있다.

다음 글에서는 많은 수의 ref를 효율적으로 저장하는 **packed-refs 파일**을 살펴본다.

---

**지난 글:** [Git Refs 내부 구조: .git/refs/ 디렉터리](/posts/git-refs-internal/)

**다음 글:** [Git packed-refs: ref를 압축 저장하는 파일](/posts/git-packed-refs/)

<br>
읽어주셔서 감사합니다. 😊
