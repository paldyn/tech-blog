---
title: "--no-ff 옵션: 머지 커밋을 항상 남기는 이유"
description: "--no-ff 옵션이 만드는 머지 커밋의 의미, 팀 협업에서 사용하는 이유, 기능 단위 롤백과의 관계를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "merge", "--no-ff", "머지 커밋", "브랜치 전략"]
featured: false
draft: false
---

[지난 글](/posts/git-three-way-merge/)에서 3-way merge의 내부 원리를 살펴봤다. fast-forward가 가능한 상황에서도 의도적으로 머지 커밋을 남기고 싶을 때 **`--no-ff`** 옵션을 사용한다. 작은 옵션 하나지만 히스토리 가독성과 롤백 전략에 큰 차이를 만든다.

## --no-ff가 만드는 차이

fast-forward는 포인터만 이동해 히스토리가 직선으로 보인다. 브랜치로 작업했다는 흔적이 사라진다.

`--no-ff`는 fast-forward가 가능해도 **새 머지 커밋을 생성**한다. `git log --graph`에서 브랜치가 갈라졌다 합쳐지는 모양이 그대로 남는다.

![FF vs --no-ff 히스토리 비교](/assets/posts/git-merge-no-ff-history.svg)

## 기본 사용법

```bash
git switch main
git merge --no-ff feature -m "Merge feature: 사용자 프로필 기능"
```

`-m` 없이 실행하면 에디터가 열리고 기본 메시지(`Merge branch 'feature'`)가 채워진다.

## 기능 단위 롤백이 쉬워진다

--no-ff의 가장 실질적인 이점이다. 머지 커밋이 있으면 `git revert`로 기능 전체를 한 번에 되돌릴 수 있다.

```bash
# 로그에서 머지 커밋 확인
git log --oneline --graph
# *   f3a1b2c Merge feature: 사용자 프로필 기능
# |\
# | * e4d5c6b 프로필 이미지 업로드 추가
# | * a1b2c3d 프로필 페이지 라우팅
# |/
# * 9f8e7d6 이전 커밋

# 기능 전체 롤백 (머지 커밋 기준)
git revert -m 1 f3a1b2c
```

`-m 1`은 머지 커밋의 "첫 번째 부모"(병합을 받은 쪽, 즉 `main`)를 기준으로 되돌린다는 의미다. fast-forward였다면 커밋을 하나씩 `revert`해야 한다.

![--no-ff 활용 패턴](/assets/posts/git-merge-no-ff-commands.svg)

## 기본값으로 설정하기

프로젝트 전체에 `--no-ff`를 강제하려면:

```bash
# 현재 저장소만
git config merge.ff false

# 모든 저장소
git config --global merge.ff false
```

`merge.ff false`이면 fast-forward 가능 상황에도 항상 머지 커밋을 생성한다. `only`로 설정하면 반대로 fast-forward만 허용한다.

```bash
# FF가 불가능하면 오류로 중단 (자동화에 유용)
git config merge.ff only
```

## 언제 --no-ff를 쓸까

| 상황 | 권장 |
|------|------|
| PR/MR을 통한 기능 병합 | `--no-ff` (작업 단위 보존) |
| 릴리스 브랜치 → main | `--no-ff` (릴리스 경계 명확히) |
| hotfix 빠른 적용 | FF 허용 가능 |
| 개인 로컬 실험 브랜치 | FF로 충분 |

GitHub/GitLab의 "Create a merge commit" 옵션이 바로 `--no-ff`다. "Squash and merge"나 "Rebase and merge"와 달리 원본 커밋을 모두 보존한 채 머지 커밋만 추가한다.

## 요약

- `--no-ff`는 fast-forward를 억제하고 머지 커밋을 강제로 생성한다
- 브랜치 작업 단위가 히스토리에 남아 `git revert`로 기능별 롤백이 가능하다
- `git config merge.ff false`로 프로젝트 전체에 적용할 수 있다

---

**지난 글:** [3-Way Merge: 갈라진 브랜치를 합치는 원리](/posts/git-three-way-merge/)

**다음 글:** [Squash Merge: 커밋을 하나로 압축해 병합하기](/posts/git-merge-squash/)

<br>
읽어주셔서 감사합니다. 😊
