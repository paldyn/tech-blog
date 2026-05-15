---
title: "Fast-Forward Merge: 직선 히스토리로 브랜치 병합하기"
description: "Fast-forward merge의 동작 원리, 발생 조건, --ff-only 옵션 활용, 그리고 --no-ff와의 차이를 명확히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "merge", "fast-forward", "브랜치", "병합"]
featured: false
draft: false
---

[지난 글](/posts/git-detached-head/)에서 Detached HEAD 상태를 살펴봤다. 이번에는 두 브랜치를 합치는 방법 중 가장 단순한 형태인 **Fast-Forward Merge**를 다룬다. 원리를 이해하면 언제 쓸지, 언제 피할지를 판단할 수 있다.

## Fast-Forward란

`main`에서 `feature` 브랜치를 만든 뒤, `main`에는 아무 커밋도 없고 `feature`만 앞으로 나아간 상태를 생각해보자.

```
main: C1 → C2
                 ↘
feature:           C3 → C4
```

이 상황에서 `main`을 `feature`에 병합하면, Git은 그냥 `main` 포인터를 `C4`로 **앞으로 이동**시킬 수 있다. 새 커밋을 만들 필요가 없다. 이것이 **Fast-Forward**다.

```
main: C1 → C2 → C3 → C4
                       ↑
                  main (이동 후)
```

![Fast-Forward Merge 원리](/assets/posts/git-fast-forward-merge-concept.svg)

## 발생 조건

Fast-forward는 병합 대상 브랜치가 현재 브랜치의 **직접적인 선조(ancestor)**일 때만 가능하다. `main`이 `feature`의 히스토리 안에 포함되어 있어야 한다는 뜻이다.

`main`에 별도의 커밋이 생기면 두 브랜치가 "갈라진" 상태가 되어 fast-forward가 불가능해지고, Git은 3-way merge나 rebase를 요구한다.

## 기본 명령

```bash
git switch main
git merge feature
# Updating a1b2c3..f4e5d6
# Fast-forward
#  app.js | 24 ++++++++++++++++++++++++
#  1 file changed, 24 insertions(+)
```

출력에 `Fast-forward`가 표시되면 머지 커밋 없이 포인터만 이동한 것이다.

![Fast-Forward 명령 비교](/assets/posts/git-fast-forward-merge-commands.svg)

## --ff-only: Fast-Forward만 허용

fast-forward가 불가능할 때 실수로 3-way merge가 발생하는 것을 막고 싶다면 `--ff-only` 옵션을 사용한다.

```bash
git merge --ff-only feature
# main에 별도 커밋이 있으면 오류 발생:
# fatal: Not possible to fast-forward, aborting.
```

CI/CD 스크립트나 자동화 파이프라인에서 히스토리가 항상 직선임을 보장할 때 유용하다.

## --no-ff: Fast-Forward 비활성화

반대로, fast-forward가 가능한 상황에서도 **머지 커밋을 남기고 싶을 때** `--no-ff`를 쓴다.

```bash
git merge --no-ff feature -m "Merge feature: 로그인 기능 추가"
```

머지 커밋이 생기면 `git log --graph`에서 브랜치가 갈라졌다 합쳐지는 흔적을 볼 수 있다. 작업 단위가 명확히 남아 코드 리뷰나 롤백이 쉬워진다.

## 팀 정책 예시

| 정책 | 명령 | 언제 쓰나 |
|------|------|-----------|
| 히스토리 깔끔하게 | `merge` (기본 FF) | 개인 작업, 짧은 브랜치 |
| 브랜치 흔적 보존 | `merge --no-ff` | 팀 협업, PR 단위 작업 |
| FF 강제 (에러 방지) | `merge --ff-only` | 자동화, 릴리스 스크립트 |

## 자주 하는 실수: push 전 pull 없이 병합

원격에 새 커밋이 있는데 `git fetch` 없이 병합하면 fast-forward가 실패할 수 있다. 항상 최신 상태를 먼저 받아오자.

```bash
git fetch origin main
git merge --ff-only origin/main  # 원격을 fast-forward로 적용
```

---

**다음 글:** [3-Way Merge: 갈라진 브랜치를 합치는 원리](/posts/git-three-way-merge/)

<br>
읽어주셔서 감사합니다. 😊
