---
title: "git reset: soft·mixed·hard 세 가지 모드 완전 정복"
description: "git reset의 --soft, --mixed, --hard 각 모드가 HEAD·인덱스·워킹트리에 미치는 영향과 실전 사용 시나리오를 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "git reset", "soft", "mixed", "hard", "되돌리기"]
featured: false
draft: false
---

[지난 글](/posts/git-restore/)에서 `git restore`로 파일을 복원하는 법을 살펴봤다. 이번에는 Git에서 가장 강력하면서 오해도 많은 명령, `git reset`을 다룬다. 세 가지 모드가 각각 어디에 영향을 주는지 정확히 이해해야 원하는 결과를 얻을 수 있다.

## git reset이 하는 일

`git reset [mode] <commit>`은 두 가지를 한다.

1. **HEAD(와 현재 브랜치 포인터)를 지정한 커밋으로 이동**
2. 모드에 따라 인덱스(스테이징 영역)와 워킹트리를 어떻게 처리할지 결정

모드를 지정하지 않으면 `--mixed`가 기본값이다.

```bash
git reset HEAD~1         # --mixed (기본)
git reset --soft HEAD~1  # 소프트
git reset --hard HEAD~1  # 하드
```

## 세 모드의 차이

![git reset 세 가지 모드 비교](/assets/posts/git-reset-types-comparison.svg)

### --soft: 커밋만 취소

```bash
git reset --soft HEAD~1
```

HEAD와 브랜치 포인터를 한 단계 뒤로 옮기지만, 인덱스와 워킹트리는 건드리지 않는다. 이전 커밋의 변경이 **스테이징된 상태로 남는다**.

사용 시나리오:
- 커밋 메시지를 잘못 썼을 때 (커밋 취소 후 메시지 수정)
- 여러 커밋을 하나로 합치고 싶을 때 (여러 번 `--soft` 후 한 번 커밋)

```bash
# 커밋 메시지 수정
git reset --soft HEAD~1
git commit -m "올바른 커밋 메시지"
```

### --mixed: 커밋 + 스테이징 취소

```bash
git reset HEAD~1        # --mixed 기본값
git reset --mixed HEAD~1  # 명시적
```

HEAD를 이동하고, 인덱스도 해당 커밋 상태로 리셋한다. 워킹트리는 그대로 두므로 파일 내용은 유지되지만 **스테이징이 풀린다(Modified 상태)**.

사용 시나리오:
- 커밋을 취소하고 변경을 재분류해서 다시 커밋하고 싶을 때
- 스테이징 취소(언스테이징)

```bash
# 언스테이징 (구버전 방식, 현재는 git restore --staged 권장)
git reset HEAD src/app.js
```

### --hard: 완전 삭제

```bash
git reset --hard HEAD~1
```

HEAD 이동, 인덱스 리셋, 워킹트리까지 지정 커밋 상태로 덮어쓴다. 이후의 모든 변경이 사라진다.

**⚠ 위험**: 커밋되지 않은 변경은 복구할 방법이 없다. Untracked 파일도 영향을 받지 않지만, 스테이징됐던 변경은 모두 지워진다.

![git reset 실전 예시](/assets/posts/git-reset-types-examples.svg)

## --hard 이후 복구

`git reset --hard`로 커밋을 날렸더라도 **reflog**를 통해 복구 가능하다.

```bash
git reflog
# a3f9d21 HEAD@{0}: reset: moving to HEAD~1
# 9bc4e82 HEAD@{1}: commit: feat: add login page  ← 이걸 복구

git reset --hard 9bc4e82
# 또는
git reset --hard HEAD@{1}
```

단, Untracked 파일(한 번도 `git add`하지 않은 파일)은 reflog에도 없으므로 복구 불가능하다.

## 파일 단위 reset

커밋 해시와 파일 경로를 함께 지정하면 해당 파일만 인덱스에 특정 버전으로 복원한다.

```bash
# HEAD~2의 파일을 인덱스로 가져오기 (워킹트리는 그대로)
git reset HEAD~2 src/config.js

# 이후 git status로 확인
git status
# Changes to be committed:
#       modified:   src/config.js
```

이 동작은 `git restore --staged --source HEAD~2 src/config.js`와 동일하다.

## reset vs restore vs revert

| 명령 | 용도 | 히스토리 |
|------|------|---------|
| `git reset` | HEAD·인덱스·워킹트리 이동 | 변경 (위험) |
| `git restore` | 파일 내용 복원 | 변경 없음 |
| `git revert` | 이전 커밋을 취소하는 새 커밋 | 보존 |

공유된 브랜치(push한 이후)에서는 `git reset`으로 커밋을 제거하면 다른 팀원의 히스토리와 충돌이 생긴다. 이미 push한 커밋을 되돌려야 한다면 `git revert`를 사용한다.

## 정리: 어떤 상황에 어떤 모드를

```bash
# 아직 push 안 한 로컬 커밋, 변경 유지하며 취소
git reset --soft HEAD~1

# 아직 push 안 한 로컬 커밋, 재작업 필요
git reset HEAD~1

# 실험적 변경을 완전히 버리고 싶음 (저장 불필요)
git reset --hard HEAD

# push한 커밋을 되돌리는 경우
git revert HEAD   # reset 대신 revert 사용
```

`--hard`는 강력하지만 그만큼 주의가 필요하다. 습관적으로 stash 후 reset하는 패턴을 쓰면 실수로 인한 데이터 손실을 줄일 수 있다.

---

**지난 글:** [git restore: 파일을 원하는 상태로 되돌리기](/posts/git-restore/)

<br>
읽어주셔서 감사합니다. 😊
