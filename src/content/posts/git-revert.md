---
title: "git revert — 안전하게 커밋 되돌리기"
description: "git revert로 공유 브랜치에서 안전하게 특정 커밋을 되돌리는 방법, reset과의 차이, 주요 옵션과 충돌 처리를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "revert", "되돌리기", "히스토리 보존", "공유 브랜치"]
featured: false
draft: false
---

[지난 글](/posts/git-bfg-cleaner/)에서 BFG로 히스토리를 정리하는 방법을 살펴봤다. 이번에는 방향을 바꿔 **이미 push된 커밋을 안전하게 되돌리는** `git revert`를 다룬다. `reset`처럼 히스토리를 지우지 않고 새 커밋을 추가하는 방식이라 공유 브랜치에서 사용할 수 있다.

## revert의 동작 원리

`git revert`는 지정한 커밋의 변경사항을 **반대로 적용**하는 새 커밋을 만든다. 예를 들어 커밋 B가 파일에 줄을 추가했다면, `git revert B`는 그 줄을 삭제하는 커밋을 추가한다.

![git revert 동작 개념](/assets/posts/git-revert-concept.svg)

히스토리는 보존된다. B는 여전히 히스토리에 남고, 그 효과만 취소된 "Revert B" 커밋이 새로 쌓인다. 이 방식 덕분에 팀원이 이미 pull한 상태라도 충돌 없이 반영할 수 있다.

## reset과의 차이

```bash
# reset: 히스토리를 삭제 (push 후엔 위험)
git reset --hard HEAD~1  # 마지막 커밋 삭제

# revert: 히스토리를 보존하고 새 커밋 추가 (push 후 안전)
git revert HEAD          # 마지막 커밋을 되돌리는 커밋 추가
```

| | reset | revert |
|---|---|---|
| 히스토리 | 삭제 | 보존 |
| push 후 사용 | 위험 (force push 필요) | 안전 |
| 공유 브랜치 | 금지 | 권장 |
| 이력 감사 | 흔적 없음 | 언제 무엇을 되돌렸는지 기록됨 |

## 기본 사용법

```bash
# 특정 커밋 revert (SHA 지정)
git revert abc1234

# HEAD (가장 최근 커밋) revert
git revert HEAD

# HEAD에서 2번째 커밋 revert
git revert HEAD~2
```

명령 실행 후 에디터가 열리고 기본 커밋 메시지가 채워진다. 수정하거나 그대로 저장한다.

## 주요 옵션

![revert 주요 옵션](/assets/posts/git-revert-options.svg)

## --no-commit으로 여러 커밋 묶기

여러 커밋을 revert할 때 각각 별도 커밋으로 만들고 싶지 않다면 `--no-commit`(`-n`)으로 스테이징만 하고 마지막에 한 번에 커밋한다.

```bash
# 각각 스테이징만
git revert --no-commit abc1234
git revert --no-commit def5678
git revert --no-commit ghi9012

# 하나의 커밋으로 묶기
git commit -m "revert: 릴리스 X에서 도입된 버그 되돌리기"
```

이렇게 하면 세 커밋의 효과가 하나의 깔끔한 revert 커밋으로 표현된다.

## 충돌 처리

revert할 커밋과 이후 커밋 사이에 의존 관계가 있으면 충돌이 날 수 있다.

```bash
# 충돌 발생 시
git revert abc1234
# CONFLICT (content): Merge conflict in src/auth.js

# 충돌 해결 후
git add src/auth.js
git revert --continue

# 포기하고 원래 상태로
git revert --abort
```

충돌이 복잡하다면 `--no-commit`으로 스테이징한 뒤 수동으로 내용을 조정하고 커밋하는 방법도 있다.

## 실전: 프로덕션 버그 롤백

배포 후 버그가 발견됐을 때의 일반적인 흐름이다.

```bash
# 버그가 있는 커밋 찾기
git log --oneline -20

# 해당 커밋 revert
git revert abc1234 --no-edit

# 즉시 push
git push origin main

# 또는 태그된 릴리스 전체 revert
git revert v2.1.0..HEAD --no-commit
git commit -m "revert: v2.1.0 이후 변경사항 롤백"
git push origin main
```

머지 커밋을 revert하는 경우는 `-m` 옵션이 추가로 필요한데, 이는 다음 글에서 자세히 다룬다.

---

**지난 글:** [BFG Repo-Cleaner — 대용량·비밀 파일 제거](/posts/git-bfg-cleaner/)

**다음 글:** [git revert — 머지 커밋 되돌리기](/posts/git-revert-merge/)

<br>
읽어주셔서 감사합니다. 😊
