---
title: "Fast-forward only 정책으로 선형 히스토리 유지하기"
description: "머지 커밋 없이 일직선 히스토리를 강제하는 fast-forward only 정책의 동작 원리와, --ff-only가 머지를 거부하는 경우, pull.ff 설정과 브랜치별 강제 방법, 선형 히스토리의 장단점과 팀 운영 시 고려사항을 설명한다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "fast-forward", "머지정책", "선형히스토리", "rebase", "협업"]
featured: false
draft: false
---

[지난 글](/posts/git-revert-merge-issue/)에서 머지 커밋 revert의 함정을 다뤘다. 머지 커밋이 얽히면 되돌리기도 히스토리 읽기도 까다로워진다. 그래서 어떤 팀은 아예 **머지 커밋을 만들지 않는** 정책을 택한다. 바로 fast-forward only 전략이다. 이번 글에서는 ff-only가 무엇을 보장하고 무엇을 거부하는지, 그리고 이를 설정으로 강제하는 방법을 살펴본다.

## fast-forward란 무엇인가

fast-forward 머지는 새 커밋을 만들지 않고 **브랜치 포인터만 앞으로 옮기는** 통합이다. `main`이 `feature`의 조상이고 그 사이에 다른 변경이 없다면, Git은 그냥 `main`을 `feature`가 가리키는 커밋으로 이동시킨다. 히스토리가 한 줄로 깔끔하게 이어진다.

반대로 `main`과 `feature`가 서로 갈라져 양쪽 모두에 새 커밋이 생겼다면 fast-forward가 불가능하다. 이때 일반 머지는 두 갈래를 잇는 머지 커밋을 만들지만, `--ff-only`는 **머지 자체를 거부**한다.

![fast-forward 가능·불가능 상황 비교](/assets/posts/git-fast-forward-only-policy-compare.svg)

## --ff-only로 머지하기

`--ff-only` 플래그를 붙이면 fast-forward가 가능할 때만 통합한다.

```bash
# ff가 가능하면 포인터만 이동, 불가능하면 에러로 거부
git merge --ff-only feature
```

거부됐다는 것은 "그 사이 main이 앞서 나갔다"는 신호다. 이때는 feature를 최신 `main` 위로 리베이스해 일직선으로 만든 뒤 다시 시도한다.

```bash
# feature를 main 끝으로 옮겨 붙여 ff가 가능하게 만든다
git switch feature
git rebase main
git switch main
git merge --ff-only feature
```

이 흐름을 강제하면 모든 통합이 리베이스를 거쳐 일직선으로 정리되므로, 히스토리에 머지 커밋이 끼어들지 않는다.

## 설정으로 정책 고정하기

매번 플래그를 붙이는 대신 설정으로 강제할 수 있다. 가장 흔히 쓰는 것은 `pull.ff`다.

![ff-only를 설정으로 강제하기](/assets/posts/git-fast-forward-only-policy-config.svg)

```bash
# pull 시 ff가 불가능하면 자동 머지 대신 멈춘다 (불필요한 머지 커밋 방지)
git config --global pull.ff only
```

이렇게 두면 `git pull`이 갈라진 상황에서 멋대로 머지 커밋을 만들지 않고 멈춘다. 사용자는 `git pull --rebase`로 리베이스하거나 명시적으로 머지를 선택하게 된다. 특정 브랜치에만 적용하고 싶다면 `mergeoptions`를 쓴다.

```bash
# main 브랜치 머지는 항상 ff-only로
git config branch.main.mergeoptions "--ff-only"
```

원격 차원에서 강제하려면 GitHub·GitLab의 브랜치 보호 규칙에서 머지 방식을 "Rebase and merge" 또는 "Fast-forward only"로 제한하면 된다. 그러면 PR도 일직선 히스토리를 유지한다.

## 장단점과 운영 고려사항

ff-only 정책에는 분명한 장단이 있다.

**장점**

- 히스토리가 완전히 선형이라 `git log`가 읽기 쉽다.
- `git bisect`가 단순해진다(분기가 없으니 이진 탐색이 깔끔하다).
- 머지 커밋 revert의 함정 같은 복잡성이 사라진다.

**단점·주의**

- 통합 전마다 리베이스가 필요해 작업 흐름이 다소 번거롭다.
- 이미 공유된 브랜치를 리베이스하면 히스토리를 다시 쓰게 되므로, **자기 feature 브랜치에서만** 리베이스해야 한다.
- "브랜치가 언제 합쳐졌는지"라는 머지 시점 정보가 히스토리에서 사라진다.

```bash
# 선형 히스토리를 한눈에 확인
git log --oneline --graph -10
```

정리하면 fast-forward only는 **선형 히스토리의 단순함을 얻는 대신 통합 전 리베이스라는 비용을 치르는** 정책이다. 머지 커밋의 복잡성을 싫어하는 팀, bisect를 자주 쓰는 팀에 특히 잘 맞는다. 다만 공유 브랜치 리베이스 금지라는 원칙만은 반드시 함께 지켜야 사고를 막을 수 있다.

---

**지난 글:** [머지 커밋 revert의 함정과 해결](/posts/git-revert-merge-issue/)

<br>
읽어주셔서 감사합니다. 😊
