---
title: "Rebase 기초: 커밋을 새 베이스 위에 재적용하기"
description: "git rebase의 동작 원리, merge와의 히스토리 차이, 기본 사용 흐름, 충돌 처리 방법을 단계별로 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "rebase", "히스토리", "브랜치", "충돌"]
featured: false
draft: false
---

[지난 글](/posts/git-merge-strategies/)에서 다양한 merge 전략을 살펴봤다. 이번에는 히스토리를 직선으로 만드는 또 다른 방법, **`git rebase`**를 다룬다. 처음 접하면 개념이 낯설지만, 핵심은 단순하다. "커밋들을 새 베이스 위에 옮겨 붙인다."

## rebase의 핵심 개념

`feature` 브랜치가 `main`의 C2에서 분기했고, 그 사이 `main`에 C3이 추가된 상황이라 하자.

```
      C3  (main)
     /
C1-C2
     \
      F1-F2  (feature)
```

`feature`에서 `git rebase main`을 실행하면 Git은 다음을 수행한다.

1. `feature`의 커밋(F1, F2)을 임시로 분리
2. `feature`의 시작점을 `main`의 끝(C3)으로 이동
3. F1, F2를 C3 위에 순서대로 **재적용(replay)**
4. 새로 만들어진 F1′, F2′는 SHA-1이 다른 새 커밋

결과적으로 히스토리가 직선이 된다.

```
C1-C2-C3-F1'-F2'  (feature, C3 위에 재적용)
```

![rebase 동작 원리](/assets/posts/git-rebase-basics-concept.svg)

## 기본 명령

```bash
# feature 브랜치에서 실행
git switch feature
git rebase main

# rebase 후 main을 fast-forward
git switch main
git merge --ff-only feature
```

rebase 후에는 `feature`가 `main`의 직접적인 후손이 되므로, `main`의 병합이 항상 fast-forward로 처리된다. 머지 커밋이 생기지 않는다.

![rebase 명령과 충돌 처리](/assets/posts/git-rebase-basics-commands.svg)

## 충돌 처리

merge와 달리 rebase는 커밋을 하나씩 재적용한다. 커밋이 5개라면 충돌이 최대 5번 발생할 수 있다.

```bash
# 충돌 해결 → 스테이지 → 계속
git add 충돌파일
git rebase --continue

# 전체 취소 (rebase 이전 상태로 복구)
git rebase --abort

# 이 커밋만 건너뜀 (주의: 해당 변경사항 소실)
git rebase --skip
```

## merge와 histrory 비교

| 방식 | 히스토리 모양 | 머지 커밋 | 원본 커밋 SHA |
|------|--------------|-----------|--------------|
| merge | 갈래 | 있음 | 유지 |
| rebase | 직선 | 없음 | 바뀜 (새 커밋) |

## 황금 규칙: 공유된 커밋을 rebase하지 말 것

rebase는 커밋의 SHA-1을 바꾼다. 이미 원격에 push되어 다른 팀원이 받아간 커밋을 rebase하면, 팀원의 히스토리와 충돌한다.

```bash
# 안전: 로컬에만 있는 브랜치
git rebase main

# 위험: 이미 push된 공유 브랜치
git push origin feature  # 기존 push가 있다면
git rebase main          # ← 위험
git push --force         # ← 팀원 히스토리 망가짐
```

원격 공유 브랜치에는 rebase 대신 merge를 사용하거나, 혼자 사용하는 브랜치라면 `--force-with-lease`로 신중하게 push한다.

## 언제 rebase를 쓸까

- PR 제출 전 최신 main을 로컬 feature 브랜치에 반영할 때
- 로컬 커밋 히스토리를 정리할 때 (`-i` 인터랙티브 모드)
- 깔끔한 직선 히스토리를 유지하는 팀 정책을 따를 때

---

**지난 글:** [Merge 전략: ort, recursive, octopus, ours 비교](/posts/git-merge-strategies/)

**다음 글:** [Interactive Rebase: 커밋 수정·합치기·순서 바꾸기](/posts/git-rebase-interactive/)

<br>
읽어주셔서 감사합니다. 😊
