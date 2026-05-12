---
title: "Cherry-pick: 특정 커밋만 골라서 적용하기"
description: "git cherry-pick의 동작 원리, 단일·범위 커밋 적용, 유용한 옵션, 대표 활용 시나리오와 주의사항을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "cherry-pick", "커밋", "브랜치", "hotfix"]
featured: false
draft: false
---

[지난 글](/posts/git-rebase-vs-merge/)에서 merge와 rebase의 선택 기준을 정리했다. 이번에는 브랜치 전체를 합치지 않고 **특정 커밋만 골라 현재 브랜치에 복사**하는 `git cherry-pick`을 다룬다.

## cherry-pick이란

커밋은 "변경사항의 스냅샷"이다. `cherry-pick`은 그 변경사항을 현재 브랜치에 새 커밋으로 재적용한다. 원본 커밋은 그대로 남고, 새 커밋은 동일한 변경 내용을 담지만 SHA-1이 다른 별개의 커밋이다.

```
feature: C1 → C2 → C3 → C4
                ↑
            이것만 필요

main:    M1 → M2 → M3
                      ↓ cherry-pick C2
main:    M1 → M2 → M3 → C2'
```

![cherry-pick 원리](/assets/posts/git-cherry-pick-concept.svg)

## 기본 사용법

```bash
# 커밋 해시 확인
git log --oneline feature

# main 브랜치에서 특정 커밋 복사
git switch main
git cherry-pick abc1234
```

성공하면 즉시 커밋이 생성된다.

## 범위 지정

```bash
# abc1234 다음 커밋부터 def5678까지 (abc 미포함)
git cherry-pick abc1234..def5678

# abc1234 포함하여 def5678까지
git cherry-pick abc1234^..def5678
```

범위 내 커밋들이 순서대로 재적용된다.

![cherry-pick 명령 패턴](/assets/posts/git-cherry-pick-commands.svg)

## 유용한 옵션

| 옵션 | 설명 |
|------|------|
| `-n` / `--no-commit` | 스테이지만, 커밋하지 않음 |
| `-e` | 커밋 메시지 에디터 열기 |
| `-x` | 메시지에 원본 커밋 해시 기록 |
| `--signoff` | Signed-off-by 추가 |
| `--mainline N` | 머지 커밋 cherry-pick 시 N번째 부모 기준 |

`-n`은 여러 커밋을 하나로 합치거나 수정해서 커밋하고 싶을 때 유용하다.

```bash
# 두 커밋의 변경사항을 합쳐 하나로 커밋
git cherry-pick -n abc1234
git cherry-pick -n def5678
git commit -m "합친 변경 사항"
```

## 대표 활용 시나리오

### 1. 핫픽스를 릴리스 브랜치에 역포팅

```bash
# main에서 버그 수정 후
git switch main
git commit -m "fix: 인증 토큰 만료 버그"

# 동일 수정을 release/2.x에도 적용
git switch release/2.x
git cherry-pick <fix-커밋-해시>
```

### 2. 잘못된 브랜치에 커밋한 것 바로잡기

```bash
# feature 브랜치에 있어야 할 커밋이 main에 생겼을 때
git switch feature
git cherry-pick <main의-잘못된-커밋>

git switch main
git revert <main의-잘못된-커밋>  # main에서 제거
```

### 3. 아직 merge 전 브랜치의 특정 기능만 먼저 사용

```bash
# partner-feature 브랜치 전체 병합은 이르지만
# 특정 유틸리티 커밋만 지금 필요할 때
git cherry-pick <유틸리티-커밋-해시>
```

## 충돌 처리

rebase와 마찬가지로 cherry-pick도 충돌이 발생할 수 있다.

```bash
# 충돌 해결 → 스테이지 → 계속
git add 충돌파일
git cherry-pick --continue

# 취소
git cherry-pick --abort

# 이 커밋은 건너뜀 (변경사항 소실)
git cherry-pick --skip
```

## 남용 주의

cherry-pick은 동일한 변경사항이 **여러 브랜치에 중복**으로 존재하게 만든다. 과도하게 사용하면 나중에 merge할 때 "이미 적용된 변경"을 Git이 감지하지 못해 충돌이 반복될 수 있다. 가능하면 공통 브랜치를 통한 정식 merge 방식을 먼저 고려하자.

---

**지난 글:** [Rebase vs Merge: 어떤 것을 선택해야 할까](/posts/git-rebase-vs-merge/)

<br>
읽어주셔서 감사합니다. 😊
