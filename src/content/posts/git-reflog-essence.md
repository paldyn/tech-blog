---
title: "git reflog — 되돌린 이력까지 모두 기록"
description: "git reflog가 무엇인지, git log와 어떻게 다른지, HEAD@{N} 표기법과 reflog 출력 구조를 이해하고 실수 복구의 안전망으로 활용하는 법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "reflog", "HEAD", "복구", "이력"]
featured: false
draft: false
---

[지난 글](/posts/git-stash-pitfalls/)에서 stash의 함정과 GC에 의한 소실을 다뤘다. Git에는 `git log`에 나타나지 않는 "숨겨진 이력 기록부"가 있다 — 바로 `git reflog`다. reset으로 커밋을 지웠거나 브랜치를 실수로 삭제했을 때 reflog가 구조대 역할을 한다.

## reflog란?

`reflog`(reference log)는 **HEAD가 이동한 모든 기록**을 남긴다. 커밋, reset, rebase, cherry-pick, checkout — 어떤 동작이든 HEAD가 움직이면 기록된다.

![git log vs git reflog](/assets/posts/git-reflog-essence-concept.svg)

`git log`는 커밋 그래프만 보여준다. reset이나 rebase로 커밋이 "사라진" 것처럼 보여도 reflog에는 이전 상태가 남아 있다.

## 기본 사용법

```bash
# 전체 reflog 조회
git reflog

# 또는 명시적으로
git reflog show HEAD

# 특정 브랜치의 reflog
git reflog show main
git reflog show feature/auth

# 날짜/시간 포함
git reflog --date=iso
git reflog --date=relative   # "2 hours ago" 형태
```

## reflog 출력 구조

![reflog 출력 구조 분석](/assets/posts/git-reflog-essence-anatomy.svg)

각 줄은 세 부분으로 구성된다.

```
abc1234 HEAD@{0}: commit: feat: 로그인 구현
def5678 HEAD@{1}: reset: moving to HEAD~1
zzz9999 HEAD@{2}: commit (amend): refactor: 정리
ghi9012 HEAD@{3}: checkout: main → feature/auth
```

- `abc1234` — 해당 시점의 커밋 SHA
- `HEAD@{0}` — 현재(0)부터 거슬러 올라가는 상대 인덱스
- `commit:`, `reset:`, `checkout:` — 동작 유형과 설명

## HEAD@{N} 표기법

`HEAD@{N}`은 N번 전의 HEAD 위치를 가리킨다.

```bash
# HEAD@{N}을 실제 커밋처럼 사용 가능
git show HEAD@{3}              # 3번 전 상태 확인
git diff HEAD@{0} HEAD@{5}    # 0번과 5번 사이 차이
git checkout HEAD@{2}          # 2번 전 상태로 체크아웃

# 시간 기반 참조
git show HEAD@{1.hour.ago}     # 1시간 전 HEAD
git show HEAD@{yesterday}      # 어제 HEAD
git show main@{2.days.ago}    # 2일 전 main
```

## reflog 항목 유형

reflog에 기록되는 주요 동작들이다.

```bash
# 커밋 생성
abc1234 HEAD@{0}: commit: feat: 새 기능

# amend
def5678 HEAD@{0}: commit (amend): feat: 수정

# reset
ghi9012 HEAD@{0}: reset: moving to HEAD~2

# 브랜치 체크아웃
jkl3456 HEAD@{0}: checkout: feature → main

# rebase
mno7890 HEAD@{0}: rebase (finish): refs/heads/feature

# merge
pqr2345 HEAD@{0}: merge hotfix: Fast-forward

# stash
stu6789 HEAD@{0}: WIP on feature: abc1234 커밋 메시지
```

## reflog와 로컬 전용

reflog는 **로컬 레포에만 존재**한다. `git push`나 `git fetch`로 전달되지 않는다. 따라서:

- 동료 컴퓨터에는 내 reflog가 없다
- 레포를 새로 clone하면 reflog가 비어 있다
- 서버(GitHub/GitLab)에 reflog가 없다

```bash
# clone 직후 reflog 확인
git clone <url> new-repo
cd new-repo
git reflog
# (아무것도 없거나 clone 이벤트 1개만 있음)
```

## reflog 보존 기간

reflog는 영원히 보존되지 않는다. `git gc`가 오래된 항목을 정리한다.

```bash
# 기본 보존 기간 확인
git config gc.reflogExpire           # 기본 90일 (도달 가능 커밋)
git config gc.reflogExpireUnreachable # 기본 30일 (도달 불가 커밋)

# 특정 브랜치 더 오래 유지
git config gc.reflogExpire "180 days"

# 영구 보존
git config gc.reflogExpire never
```

## 실전: 실수 복구의 첫 단계

무언가 잘못됐을 때 reflog를 가장 먼저 열어보는 습관을 들이자.

```bash
# 1. 실수 직후 reflog 확인
git reflog

# 2. 돌아가고 싶은 지점의 SHA 또는 HEAD@{N} 확인
# HEAD@{3}: 3번 전 상태가 원하는 상태

# 3. 해당 지점으로 이동
git reset --hard HEAD@{3}
# 또는
git checkout HEAD@{3}
# 또는
git checkout -b recovery-branch HEAD@{3}
```

다음 글에서 reflog를 활용한 커밋 복구를 더 구체적으로 다룬다.

---

**지난 글:** [git stash 주의사항과 함정](/posts/git-stash-pitfalls/)

**다음 글:** [git reflog로 커밋 복구하기](/posts/git-reflog-recover-commit/)

<br>
읽어주셔서 감사합니다. 😊
