---
title: "git stash 적용 중 충돌 처리"
description: "git stash pop/apply 중 충돌이 발생하는 원인, pop과 apply의 stash 유지 차이, 충돌 해결 절차, stash branch로 안전하게 복원하는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "stash", "충돌", "conflict", "stash pop"]
featured: false
draft: false
---

[지난 글](/posts/git-conflict-during-cherry-pick/)에서 cherry-pick 중 충돌을 심화 정리했다. 이번에는 `git stash pop` 또는 `git stash apply`로 작업을 복원할 때 **현재 브랜치의 코드와 충돌이 발생하는 상황**을 다룬다.

## 왜 충돌이 발생하나

stash는 작업 디렉토리의 변경사항을 저장해두는 임시 공간이다. 저장 후 브랜치를 전환하거나 새 커밋을 추가한 뒤 복원할 때, **저장 당시와 현재 파일 상태가 다르면** 충돌이 발생한다.

```
stash 저장 시점: src/auth.py에 변경 A 포함
현재 브랜치:   src/auth.py가 변경 B로 수정됨
→ stash pop 시 같은 줄에 A와 B가 충돌
```

## stash pop vs stash apply 충돌 차이

![git stash pop/apply 충돌 흐름](/assets/posts/git-conflict-with-stash-flow.svg)

`git stash pop`은 복원 성공 시 stash를 자동 삭제한다. 그러나 **충돌이 발생하면 stash가 삭제되지 않고 남는다.** 충돌 해결 후 직접 `git stash drop`으로 제거해야 한다.

`git stash apply`는 충돌 여부와 관계없이 stash를 유지한다. 복원 후 언제든 재시도할 수 있다.

```bash
# 충돌 걱정 없이 안전하게 복원
git stash apply stash@{0}
# 충돌 해결 완료 후
git stash drop stash@{0}
```

## 충돌 해결 절차

```bash
# 1. 충돌 발생 확인
git stash pop
# CONFLICT (content): Merge conflict in src/auth.py

# 2. 현재 상태 확인
git status
# both modified: src/auth.py

# 3. 파일 편집 (마커 제거)
vim src/auth.py

# 4. 스테이지에 올리기
git add src/auth.py

# 5. pop 충돌이면 stash 수동 삭제
git stash list             # stash@{0}: ... 확인
git stash drop stash@{0}
```

커밋은 하지 않아도 된다. stash 복원 결과는 일반 변경사항과 동일하게 계속 작업하면 된다.

![stash 충돌 해결 명령어](/assets/posts/git-conflict-with-stash-resolve.svg)

## stash branch: 충돌 예방법

stash 저장 당시의 커밋 기준으로 새 브랜치를 만들어서 복원하면 충돌 없이 원본 상태를 재현할 수 있다.

```bash
git stash branch temp-work
# 1. stash 저장 시점의 커밋으로 체크아웃
# 2. stash 자동 적용 (충돌 없음)
# 3. stash 자동 삭제
```

이 방법은 stash가 오래됐거나 여러 브랜치 이동 후 복원할 때 특히 유용하다. `temp-work` 브랜치에서 작업을 완성한 뒤 main에 merge하면 된다.

## stash 관련 충돌 예방 팁

- **stash 수명을 짧게**: 저장 후 즉시 복원하면 충돌 가능성이 낮다.
- **팝 전에 상태 확인**: `git stash show -p stash@{0}`로 저장된 diff를 미리 검토한다.
- **apply 사용 습관화**: 충돌이 우려된다면 pop 대신 apply를 사용한다.

```bash
# stash 내용 미리 보기
git stash show -p stash@{0}

# stash 목록 확인
git stash list
```

---

**지난 글:** [Cherry-pick 충돌 심화: 연속 픽과 범위 픽 처리](/posts/git-conflict-during-cherry-pick/)

**다음 글:** [원격 저장소(Remote)의 본질과 역할](/posts/git-remote-essence/)

<br>
읽어주셔서 감사합니다. 😊
