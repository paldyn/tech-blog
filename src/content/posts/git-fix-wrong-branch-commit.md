---
title: "엉뚱한 브랜치에 커밋했을 때 바로잡기"
description: "feature 작업을 main에 잘못 커밋한 상황에서 커밋을 올바른 브랜치로 옮기는 방법을 푸시 전(branch+reset)과 푸시 후(cherry-pick+revert) 두 시나리오로 나눠 단계별로 설명한다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "branch", "reset", "cherry-pick", "되돌리기", "협업"]
featured: false
draft: false
---

[지난 글](/posts/git-undo-pushed-commit/)에서 푸시한 커밋을 되돌리는 법을 다뤘다. 이번에는 비슷하지만 결이 다른 실수를 본다. 변경 자체는 맞는데 **커밋을 엉뚱한 브랜치에 올린 경우**다. 새 기능을 짜다가 브랜치를 만드는 걸 깜빡하고 `main`에 바로 커밋해 버린 상황이 대표적이다. 이때 필요한 건 "되돌리기"가 아니라 "옮기기"다. 커밋을 올바른 브랜치로 이동시키고, 잘못 올라간 브랜치는 원래대로 복구하면 된다.

## 상황 정리: 옮기고, 되감기

해결의 큰 그림은 단순하다. 잘못된 커밋을 *올바른 브랜치로 복사*한 뒤, *잘못된 브랜치는 커밋 이전으로 되감는다*.

![엉뚱한 브랜치에 올린 커밋을 옮기는 흐름](/assets/posts/git-fix-wrong-branch-commit-flow.svg)

다만 "잘못된 브랜치를 되감는" 단계는 그 브랜치를 이미 푸시했는지에 따라 방법이 갈린다. 두 시나리오를 나눠 보자.

![푸시 전후에 따라 처방이 다르다](/assets/posts/git-fix-wrong-branch-commit-cherry.svg)

## 시나리오 1: 아직 푸시하지 않았다

가장 흔하고 가장 깔끔한 경우다. 현재 `main`에 잘못된 커밋이 올라가 있고 아직 푸시 전이라면, 다음 세 단계로 끝난다.

```bash
# 1) 지금 위치(잘못된 커밋 포함)에서 새 브랜치를 만들어 둔다
git branch feature

# 2) main을 커밋 직전으로 되감는다 (원격 기준)
git switch main
git reset --hard origin/main

# 3) 작업을 이어 갈 브랜치로 이동
git switch feature
```

핵심은 1번이다. `git branch feature`는 **현재 커밋을 가리키는 새 포인터**를 만들 뿐 브랜치를 바꾸지 않는다. 이렇게 커밋을 `feature`에 "묶어 둔" 다음 `main`만 안전하게 되감으면, 작업 내용은 그대로 `feature`에 남는다.

`origin/main` 대신 `HEAD~1`로 되감아도 되지만, 잘못 올린 커밋이 여러 개라면 원격 기준으로 맞추는 편이 헷갈리지 않는다.

```bash
# 잘못 올린 커밋이 하나뿐이라면 이렇게도 가능
git reset --hard HEAD~1
```

## 시나리오 2: 이미 푸시했다

`main`을 이미 원격에 푸시해 동료가 받아 갔다면, 시나리오 1의 `reset --hard`는 위험하다. 공유된 `main` 히스토리를 다시 쓰게 되기 때문이다. 이때는 **올바른 브랜치엔 cherry-pick으로 복사**하고, **main에는 revert로 취소 커밋을 남긴다**.

```bash
# 1) 올바른 브랜치로 커밋을 복사
git switch feature        # 없으면: git switch -c feature origin/main
git cherry-pick <wrong-sha>

# 2) main에서는 그 변경을 정상적으로 되돌린다
git switch main
git revert <wrong-sha>
git push origin main
```

이렇게 하면 `main`의 히스토리는 한 줄로 이어지고(커밋 추가 + 취소 커밋 추가), 동료는 단순히 `pull`만 하면 된다. 같은 변경이 `feature`에는 살아 있으므로 작업도 잃지 않는다.

## 여러 커밋을 한꺼번에 옮기기

잘못 올린 커밋이 여러 개라면 `cherry-pick`에 범위를 줄 수 있다. 범위 표기는 끝을 포함하고 시작은 제외하므로, 옮기고 싶은 첫 커밋의 *부모*를 시작점으로 지정한다.

```bash
# A..B 는 A를 제외하고 B까지 — 옮길 첫 커밋의 부모를 A로
git switch feature
git cherry-pick origin/main..main
```

## 옮긴 뒤 확인하기

마지막으로 두 브랜치가 의도대로 정리됐는지 확인한다.

```bash
# 그래프로 브랜치 분기 상태를 한눈에
git log --oneline --graph --all -8
```

`feature`에는 작업 커밋이 올라가 있고 `main`은 깨끗하게(또는 revert 커밋과 함께) 정리됐다면 성공이다. 정리하자면 **푸시 전이면 branch + reset, 푸시 후면 cherry-pick + revert**가 공식이다. 다음 글에서는 또 다른 흔한 사고, 대용량 바이너리를 실수로 커밋해 저장소가 비대해진 상황을 다룬다.

---

**지난 글:** [이미 푸시한 커밋을 안전하게 되돌리기](/posts/git-undo-pushed-commit/)

**다음 글:** [대용량 바이너리를 실수로 커밋했을 때](/posts/git-large-binary-mistake/)

<br>
읽어주셔서 감사합니다. 😊
