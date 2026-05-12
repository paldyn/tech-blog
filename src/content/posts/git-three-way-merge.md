---
title: "3-Way Merge: 갈라진 브랜치를 합치는 원리"
description: "공통 조상을 기준으로 두 브랜치를 비교하는 3-way merge의 작동 원리, 자동 병합이 성공하는 조건, 충돌이 발생하는 이유를 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "merge", "3-way merge", "conflict", "브랜치"]
featured: false
draft: false
---

[지난 글](/posts/git-fast-forward-merge/)에서 직선 히스토리의 fast-forward merge를 살펴봤다. 두 브랜치가 서로 다른 커밋을 가지고 갈라진 경우엔 **3-Way Merge**가 필요하다. Git이 어떻게 두 브랜치의 변경사항을 자동으로 합치는지, 그리고 왜 충돌이 생기는지 이해해보자.

## 왜 "3"인가

단순히 두 파일을 비교하는 2-way diff로는 문제가 있다. `main`이 함수를 삭제했고 `feature`도 같은 함수를 수정했다면, Git은 "삭제"인지 "의도적으로 다르게 쓴 것"인지 구분할 수 없다. 세 번째 기준인 **공통 조상(Base)**이 있으면 무엇이 변경된 것인지 명확해진다.

3-Way Merge의 세 스냅샷:
1. **Base** — 두 브랜치가 갈라진 공통 조상 커밋
2. **Ours** — 현재 브랜치(HEAD)의 최신 커밋
3. **Theirs** — 병합 대상 브랜치의 최신 커밋

![3-Way Merge 원리](/assets/posts/git-three-way-merge-concept.svg)

## 자동 병합 규칙

Git은 파일의 각 "덩어리(hunk)"를 세 버전과 비교한다.

| Base | Ours | Theirs | 결과 |
|------|------|--------|------|
| A | A | B | B (Theirs가 변경) |
| A | B | A | B (Ours가 변경) |
| A | B | B | B (둘 다 같은 변경) |
| A | B | C | **충돌** (둘 다 다르게 변경) |
| A | A | A | A (아무도 안 변경) |

핵심은 "누가 변경했는가"를 Base와 비교해서 판단한다는 것이다.

## 실제 명령

```bash
git switch main
git merge feature
# Merge made by the 'ort' strategy.
#  feature.js | 18 ++++++++++++++++++
#  1 file changed, 18 insertions(+)
```

fast-forward와 달리 출력에 `Fast-forward` 대신 `Merge made by` 메시지가 나타난다. 이때 **머지 커밋**이 생성된다.

## 머지 커밋의 특징

```bash
git log --oneline --graph

# *   f3a1b2c Merge branch 'feature'
# |\
# | * e4d5c6b feature: 사용자 프로필 추가
# | * a1b2c3d feature: API 연동
# * | 9f8e7d6 main: 버그 수정
# |/
# * 7c6b5a4 공통 조상 커밋
```

머지 커밋은 **두 개의 부모**를 가진다. `git log`에서 `|/` 모양으로 두 선이 합쳐지는 지점이 머지 커밋이다.

## 자동 병합 vs 충돌

![자동 병합과 충돌 비교](/assets/posts/git-three-way-merge-conflict.svg)

같은 파일도 **수정한 위치가 다르면** 자동 병합된다. 두 브랜치가 동일한 줄을 서로 다르게 수정했을 때만 충돌(CONFLICT)이 발생한다.

## 충돌 발생 시 흐름

```bash
git merge feature
# CONFLICT (content): Merge conflict in app.js
# Automatic merge failed; fix conflicts and then commit the result.

# 충돌 파일 수정 후
git add app.js
git merge --continue   # 또는 git commit
```

충돌을 해결하고 `git add`로 스테이징한 뒤 `git merge --continue`로 머지 커밋을 완성한다. 병합 자체를 취소하려면 `git merge --abort`를 쓴다.

## 공통 조상 찾기

```bash
# 두 브랜치의 공통 조상 커밋 해시 확인
git merge-base main feature
# 7c6b5a4...
```

Git이 내부적으로 이 커밋을 Base로 사용해 3-way diff를 계산한다.

---

**지난 글:** [Fast-Forward Merge: 직선 히스토리로 브랜치 병합하기](/posts/git-fast-forward-merge/)

**다음 글:** [--no-ff 옵션: 머지 커밋을 항상 남기는 이유](/posts/git-merge-no-ff/)

<br>
읽어주셔서 감사합니다. 😊
