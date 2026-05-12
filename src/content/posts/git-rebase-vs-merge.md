---
title: "Rebase vs Merge: 어떤 것을 선택해야 할까"
description: "git rebase와 git merge의 히스토리 차이, 각각의 장단점, 팀 환경에서 선택 기준을 실용적으로 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "rebase", "merge", "브랜치 전략", "히스토리"]
featured: false
draft: false
---

[지난 글](/posts/git-rebase-onto/)에서 `--onto`로 정밀하게 커밋을 이동하는 방법을 살펴봤다. 이번에는 한 발 물러서서 "언제 rebase를, 언제 merge를 써야 하는가"라는 실용적인 질문에 답한다.

## 결과는 같다, 히스토리가 다르다

`feature`를 `main`에 통합할 때 merge와 rebase 둘 다 최종 코드는 동일하다. 차이는 **히스토리**에 있다.

- **merge**: 두 브랜치가 갈라졌다 합쳐지는 흔적이 남는다. 머지 커밋이 생긴다
- **rebase**: 히스토리가 직선이 된다. 브랜치로 작업했다는 흔적이 사라진다. 커밋 SHA가 바뀐다

![Rebase vs Merge 히스토리 비교](/assets/posts/git-rebase-vs-merge-comparison.svg)

## merge의 장점

```bash
git switch main
git merge --no-ff feature
```

- **안전하다**: 커밋 SHA가 바뀌지 않아 공유 브랜치에 사용해도 문제없다
- **이력 보존**: 언제 어떤 브랜치에서 작업했는지 명확히 남는다
- **기능 단위 롤백**: `git revert -m 1 <머지커밋>`으로 기능 전체를 되돌릴 수 있다

단점은 히스토리가 복잡해진다는 것이다. 브랜치가 많으면 `git log --graph`가 복잡해 읽기 어렵다.

## rebase의 장점

```bash
git switch feature
git rebase main
git switch main
git merge --ff-only feature
```

- **직선 히스토리**: `git log`가 단순하고 `git bisect`가 빠르다
- **깔끔한 PR**: PR 제출 전 로컬에서 WIP 커밋을 정리하는 데 이상적이다
- **최신 베이스 반영**: 최신 main의 변경사항 위에서 작업한 결과를 확인하며 개발할 수 있다

단점은 **커밋 SHA가 바뀐다**는 것이다. 이미 push된 커밋을 rebase하면 force push가 필요하고, 팀원의 히스토리와 충돌한다.

## 황금 규칙: push 전후

| 타이밍 | 권장 |
|--------|------|
| 로컬, 아직 push 전 | rebase 자유롭게 가능 |
| 이미 push됨, 혼자 사용 | `--force-with-lease`로 신중하게 |
| 이미 push됨, 팀 공유 중 | **rebase 금지 → merge 사용** |

## 팀 정책 가이드

![팀 정책 가이드](/assets/posts/git-rebase-vs-merge-decision.svg)

## 두 방식 혼합하기

실무에서는 둘을 혼합해서 쓰는 경우가 많다.

1. 로컬 작업 중에는 `rebase -i`로 커밋 정리
2. 최신 main을 반영할 때도 `rebase main`으로 직선 유지
3. 최종 main 병합 시에는 `merge --no-ff`로 PR 단위 흔적 보존

```bash
# PR 제출 전 워크플로 예시
git switch feature
git rebase -i HEAD~4        # 로컬 커밋 정리
git fetch origin
git rebase origin/main       # 최신 main 반영
git push --force-with-lease  # 정리된 브랜치 push
# → GitHub에서 PR → Merge (--no-ff)
```

## 팀 합의가 가장 중요하다

어떤 방식이 "더 좋다"는 없다. 팀 전체가 동일한 규칙을 따르는 것이 중요하다. `CONTRIBUTING.md`나 `.github/PULL_REQUEST_TEMPLATE.md`에 정책을 명시해두면 혼선을 줄일 수 있다.

---

**지난 글:** [rebase --onto: 특정 범위 커밋만 옮기기](/posts/git-rebase-onto/)

**다음 글:** [Cherry-pick: 특정 커밋만 골라서 적용하기](/posts/git-cherry-pick/)

<br>
읽어주셔서 감사합니다. 😊
