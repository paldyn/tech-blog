---
title: "git reflog로 커밋 복구하기"
description: "git reset --hard, amend, rebase로 잃어버린 커밋을 reflog에서 찾아 복구하는 방법을 단계별로 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "reflog", "복구", "reset", "커밋 복원"]
featured: false
draft: false
---

[지난 글](/posts/git-reflog-essence/)에서 reflog의 개념과 구조를 살펴봤다. 이번에는 reflog를 실제로 활용해 **잃어버린 커밋을 복구**하는 방법을 단계별로 알아본다. `git reset --hard`로 커밋을 날려버렸거나 `amend`로 덮어썼을 때도 reflog가 있으면 대부분 살릴 수 있다.

## 시나리오 1: reset --hard로 커밋 날림

가장 흔한 실수다. 몇 개의 커밋이 "사라진" 것처럼 보이지만 reflog에는 남아 있다.

![reset --hard 후 커밋 복구](/assets/posts/git-reflog-recover-commit-flow.svg)

```bash
# 실수
git reset --hard HEAD~3   # 최근 3개 커밋 날림

# 즉시 reflog 확인
git reflog
# abc1234 HEAD@{0}: reset: moving to HEAD~3
# def5678 HEAD@{1}: commit: feat: 결제 모듈
# ghi9012 HEAD@{2}: commit: feat: 장바구니
# jkl3456 HEAD@{3}: commit: feat: 로그인
```

복구할 커밋의 SHA(`jkl3456`)나 인덱스(`HEAD@{3}`)를 찾았다면:

```bash
# 방법 1: reset --hard로 되돌리기 (가장 간단)
git reset --hard HEAD@{3}

# 방법 2: SHA 직접 지정
git reset --hard jkl3456
```

## 시나리오 2: amend로 덮어쓴 커밋 복원

`git commit --amend`는 이전 커밋을 새 커밋으로 교체한다. 기존 커밋은 reflog에 남는다.

```bash
# amend 실수
git commit --amend -m "잘못된 메시지"

# reflog에서 amend 전 커밋 찾기
git reflog
# abc1234 HEAD@{0}: commit (amend): 잘못된 메시지
# def5678 HEAD@{1}: commit: 원래 올바른 메시지   ← 이게 원본

# 방법 1: reset으로 amend 전으로 되돌리기
git reset --soft HEAD@{1}   # 변경사항은 staged로 유지

# 방법 2: 현재 커밋을 유지하면서 원본만 확인
git show HEAD@{1}            # 원본 내용 확인
```

## 시나리오 3: 특정 커밋만 꺼내기

현재 브랜치는 그대로 두고 잃어버린 커밋의 내용만 가져오고 싶을 때.

![커밋 복구 시나리오별 명령](/assets/posts/git-reflog-recover-commit-scenarios.svg)

```bash
# 복구 대상 SHA 확인
git reflog
# abc1234 HEAD@{5}: commit: feat: 중요한 기능

# 새 브랜치로 해당 커밋 체크아웃
git checkout -b recovery/important-feature abc1234

# 또는 cherry-pick으로 현재 브랜치에 가져오기
git cherry-pick abc1234
```

## 시나리오 4: 잘못된 rebase 후 복구

interactive rebase 중 실수로 커밋을 drop했거나 rebase 결과가 잘못됐을 때.

```bash
# rebase 전 상태 찾기
git reflog
# abc1234 HEAD@{0}: rebase (finish): returning to refs/heads/feature
# def5678 HEAD@{1}: rebase (pick): feat: 기능 C
# ghi9012 HEAD@{2}: rebase (pick): feat: 기능 B
# jkl3456 HEAD@{3}: rebase (start): checkout main
# mno7890 HEAD@{4}: commit: feat: 기능 C   ← rebase 전 원본

# rebase 전 상태로 완전 복구
git reset --hard HEAD@{4}

# 또는 ORIG_HEAD 사용 (rebase 직전 기록)
git reset --hard ORIG_HEAD
```

`ORIG_HEAD`는 위험한 동작(merge, rebase, reset) 이전의 HEAD를 자동으로 저장하는 특수 ref다.

## 복구 과정 전체 예시

```bash
# 1. 문제 상황 파악
git log --oneline
# abc1234 (HEAD) init   ← 최근 커밋만 있음

# 2. reflog 전체 확인
git reflog
# abc1234 HEAD@{0}: reset: moving to HEAD~5
# def5678 HEAD@{1}: commit: feat: 5번째 커밋
# ghi9012 HEAD@{2}: commit: feat: 4번째 커밋
# ...

# 3. 원하는 커밋 내용 미리 확인
git show HEAD@{1}             # 변경 내용 확인
git diff HEAD HEAD@{1}        # 현재와 차이 확인

# 4. 복구 실행
git reset --hard HEAD@{1}

# 5. 확인
git log --oneline
```

## --hard vs --soft: 복구 방식 선택

```bash
# --hard: 워킹 트리·스테이징 모두 복구
git reset --hard HEAD@{3}

# --soft: 커밋 이력만 복구, 변경사항은 staged로 유지
git reset --soft HEAD@{3}

# --mixed (기본): 커밋 이력 복구, 변경사항은 unstaged로 유지
git reset HEAD@{3}
```

코드를 완전히 그 시점으로 되돌리려면 `--hard`, 커밋 구조만 되돌리고 변경사항은 남기려면 `--soft`를 쓴다.

## 주의사항

```bash
# GC 후에는 도달 불가 커밋이 사라짐
# 실수 직후 즉시 시도할 것

# push된 커밋을 reset --hard 후 force push는 팀에 영향
# 개인 브랜치가 아니라면 revert 사용 권장

# reflog는 로컬 전용
# 다른 컴퓨터에서는 reflog가 없음
```

---

**지난 글:** [git reflog — 되돌린 이력까지 모두 기록](/posts/git-reflog-essence/)

**다음 글:** [git reflog로 브랜치 복구하기](/posts/git-reflog-recover-branch/)

<br>
읽어주셔서 감사합니다. 😊
