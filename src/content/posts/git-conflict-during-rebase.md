---
title: "Rebase 중 충돌 처리: 커밋별 해결 전략"
description: "git rebase 중 충돌이 발생하는 구조, 커밋 단위로 충돌을 해결하는 흐름, --continue, --abort, --skip 사용법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "rebase", "충돌", "conflict", "--continue"]
featured: false
draft: false
---

[지난 글](/posts/git-rerere/)에서 rerere로 충돌 해결책을 재사용하는 방법을 배웠다. 이번에는 **rebase 진행 중 충돌이 발생했을 때의 구체적인 처리 방법**을 다룬다. rebase는 커밋을 하나씩 재적용하기 때문에 충돌도 커밋 단위로 발생한다는 점이 merge와 다르다.

## rebase 충돌의 특징

merge 충돌은 병합 지점에서 한 번에 발생하지만, rebase는 커밋 N개를 순서대로 재적용하므로 최대 N번의 충돌이 발생할 수 있다. 각 충돌을 해결한 뒤 `--continue`로 다음 커밋으로 넘어가는 과정을 반복한다.

```bash
# feature 브랜치를 main 기준으로 rebase
git checkout feature
git rebase main
```

세 커밋(X1, X2, X3)을 가진 feature를 rebase하면 X1, X2, X3 순서로 재적용된다.

## 충돌 발생 시 흐름

![Rebase 중 충돌 처리 흐름](/assets/posts/git-conflict-during-rebase-flow.svg)

X2를 적용하다가 충돌이 나면 Git은 멈추고 메시지를 출력한다.

```
CONFLICT (content): Merge conflict in src/auth.py
error: could not apply d3f4e5c... feat: add token refresh
hint: Resolve all conflicts manually, mark them with
hint: "git add/rm <conflicted_files>", then run
hint: "git rebase --continue".
```

이때 `git status`를 실행하면 현재 상태를 확인할 수 있다.

```bash
git status
# rebase in progress; onto 8a2b3c4
# You are currently rebasing branch 'feature' on '8a2b3c4'.
# ...
# Unmerged paths:
#   both modified: src/auth.py
```

## 단계별 처리 방법

```bash
# 1. 어떤 커밋을 처리 중인지 확인
cat .git/REBASE_HEAD

# 2. 충돌 파일 편집 (마커 제거)
vim src/auth.py

# 3. 스테이지에 올리기
git add src/auth.py

# 4. 다음 커밋으로 진행
git rebase --continue
```

`--continue` 실행 시 커밋 메시지 편집기가 열린다. 원본 메시지를 그대로 저장하거나 수정한다.

![Rebase 충돌 해결 명령어](/assets/posts/git-conflict-during-rebase-commands.svg)

## 전체 중단: --abort

충돌이 복잡하거나 rebase 전략을 재검토해야 할 때는 전체를 취소한다.

```bash
git rebase --abort
```

브랜치가 rebase 시작 이전 상태로 완전히 복구된다.

## 이 커밋 건너뛰기: --skip

특정 커밋의 변경사항이 이미 base에 반영됐거나 필요 없을 때만 사용한다.

```bash
git rebase --skip
```

`--skip`은 해당 커밋 전체를 포기한다. 코드가 영구적으로 사라지므로 신중하게 사용해야 한다.

## 진행 상태 파악

rebase 중에는 `.git/rebase-merge/` 또는 `.git/rebase-apply/` 디렉토리가 생성된다.

```bash
# 남은 커밋 목록 확인
cat .git/rebase-merge/todo

# 현재 처리 중인 커밋 번호
cat .git/rebase-merge/msgnum

# 전체 커밋 수
cat .git/rebase-merge/end
```

## 잦은 충돌을 줄이는 방법

rebase 충돌의 빈도를 줄이려면 다음 방법이 효과적이다.

- **브랜치 수명을 짧게 유지**: 오래 분기한 브랜치일수록 main과의 차이가 커져 충돌이 많다.
- **자주 rebase**: 매일 또는 매 스프린트마다 `git rebase main`을 실행해 주면 한 번의 충돌 범위가 작다.
- **rerere 활성화**: 반복되는 충돌 패턴을 자동 해결한다.

```bash
# 매일 아침 작업 전에 rebase
git fetch origin
git rebase origin/main
```

---

**지난 글:** [rerere: 충돌 해결책을 기억하고 재사용하기](/posts/git-rerere/)

**다음 글:** [Cherry-pick 충돌 심화: 연속 픽과 범위 픽 처리](/posts/git-conflict-during-cherry-pick/)

<br>
읽어주셔서 감사합니다. 😊
