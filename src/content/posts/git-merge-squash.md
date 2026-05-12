---
title: "Squash Merge: 커밋을 하나로 압축해 병합하기"
description: "git merge --squash의 동작 방식, 일반 merge/rebase와의 차이, 브랜치 삭제 시 주의점, GitHub Squash and merge와의 관계를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "merge", "squash", "히스토리 정리", "브랜치 전략"]
featured: false
draft: false
---

[지난 글](/posts/git-merge-no-ff/)에서 `--no-ff`로 머지 커밋을 남기는 방법을 살펴봤다. **Squash Merge**는 반대 방향의 접근이다. 브랜치에서 작업한 커밋들이 아무리 많아도, 최종 결과를 단 하나의 깔끔한 커밋으로 `main`에 추가한다.

## Squash Merge란

`--squash` 옵션은 브랜치의 모든 커밋을 **하나의 스테이지 변경사항으로 압축**한다. 여기서 주의할 점이 있다. `git merge --squash`는 커밋을 자동으로 만들지 않는다. 변경사항만 스테이지에 올려두므로, 반드시 `git commit`을 직접 실행해야 한다.

![Squash Merge 동작 원리](/assets/posts/git-merge-squash-concept.svg)

브랜치에 WIP 커밋, 오타 수정, 리뷰 피드백 반영 등 지저분한 커밋이 많더라도, main 히스토리에는 의미 있는 커밋 하나만 남는다.

## 기본 사용법

```bash
git switch main
git merge --squash feature
# Squash commit -- not updating HEAD
# Automatic merge went well; stopped before committing as requested

# 변경사항이 스테이지에 있음 — 커밋 필요
git status
# Changes to be committed: ...

git commit -m "feat: 사용자 프로필 기능 추가"
```

![Squash Merge 전체 워크플로](/assets/posts/git-merge-squash-workflow.svg)

## 브랜치 삭제 시 -D가 필요하다

squash merge는 머지 커밋이 없다. Git은 `feature` 브랜치가 `main`에 병합됐다고 인식하지 못한다. 따라서 `git branch -d feature`는 "브랜치가 fully merged되지 않았다"며 실패한다.

```bash
git branch -d feature
# error: The branch 'feature' is not fully merged.
# If you are sure you want to delete it, run 'git branch -D feature'.

git branch -D feature  # 강제 삭제
```

## --no-ff / rebase와 비교

| 방식 | 히스토리 | 작업 커밋 | 부모 수 |
|------|----------|-----------|---------|
| `merge` (FF) | 직선 | 그대로 | 1 |
| `merge --no-ff` | 갈래 | 그대로 | 2 (머지 커밋) |
| `merge --squash` | 직선 | 1개로 압축 | 1 |
| `rebase` | 직선 | 리플레이 | 1 |

squash와 rebase 둘 다 main 히스토리를 깔끔하게 만든다. 차이는 rebase가 커밋들을 하나씩 재현하는 반면, squash는 모든 변경을 단일 커밋으로 묶는다는 점이다.

## GitHub "Squash and merge"

GitHub의 PR 병합 버튼에서 "Squash and merge"를 선택하면 `git merge --squash`와 동일하게 동작한다. GitHub이 자동으로 커밋 메시지를 생성하고 커밋까지 완료해준다. PR 제목이 커밋 메시지가 된다.

## 언제 squash가 적합한가

- 브랜치에 WIP, 디버그, 오타 수정 같은 "잡음" 커밋이 많을 때
- main 히스토리를 기능 단위 한 줄로 유지하고 싶을 때
- 팀이 `git blame`으로 기능 단위 추적을 주로 할 때

반대로 커밋별 세부 이력이 중요하거나(`git bisect` 등), 팀원의 기여를 개별 커밋으로 보존하고 싶을 때는 `--no-ff`가 더 적합하다.

---

**지난 글:** [--no-ff 옵션: 머지 커밋을 항상 남기는 이유](/posts/git-merge-no-ff/)

**다음 글:** [Merge 전략(Strategy): ort, recursive, octopus 비교](/posts/git-merge-strategies/)

<br>
읽어주셔서 감사합니다. 😊
