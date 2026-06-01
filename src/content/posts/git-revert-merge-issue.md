---
title: "머지 커밋 revert의 함정과 해결"
description: "두 부모를 가진 머지 커밋을 revert할 때 -m 옵션으로 mainline을 지정해야 하는 이유와, revert한 브랜치를 다시 머지하면 변경이 들어오지 않는 함정, 그리고 revert를 한 번 더 revert해 되살리는 해결책을 설명한다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "revert", "merge", "되돌리기", "mainline", "협업"]
featured: false
draft: false
---

[지난 글](/posts/git-case-sensitivity/)에서 파일명 대소문자 문제를 다뤘다. 이번에는 되돌리기 중에서도 특히 까다로운 사례, **머지 커밋을 revert하는 상황**을 본다. 일반 커밋은 `git revert`로 간단히 되돌릴 수 있지만, 머지 커밋은 부모가 둘이라 "어느 쪽을 기준으로 되돌릴지"를 알려 줘야 한다. 게다가 한 번 revert한 브랜치를 나중에 다시 머지하려 할 때 변경이 안 들어오는 함정이 기다리고 있다. 두 문제를 차례로 풀어 보자.

## 머지 커밋은 왜 다른가

일반 커밋은 부모가 하나라 "되돌린다"는 의미가 분명하다. 그런데 머지 커밋은 부모가 둘이다. 하나는 머지를 *받은* 브랜치(보통 `main`), 다른 하나는 *합쳐진* 브랜치(`feature`)다. Git은 어느 부모를 기준선(mainline)으로 삼아 되돌릴지 스스로 결정하지 못한다. 그래서 `-m` 옵션으로 명시해야 한다.

![머지 커밋 revert에서 -m으로 mainline을 지정](/assets/posts/git-revert-merge-issue-mainline.svg)

```bash
# -m 1: 첫 번째 부모(보통 main)를 기준으로 되돌린다
# => feature가 가져온 변경이 통째로 취소됨
git revert -m 1 <merge-sha>
```

`-m 1`은 "첫 번째 부모를 그대로 유지하고, 두 번째 부모가 가져온 변경을 되돌리라"는 뜻이다. 머지를 `main`에서 했다면 보통 `-m 1`이 맞고, feature 쪽 변경 전체가 사라진다. 부모 번호를 확인하려면 `git show`로 머지 커밋을 본다.

```bash
# Merge: 줄에 두 부모 해시가 순서대로 표시된다
git show <merge-sha> | head -3
```

## 진짜 함정: 다시 머지해도 안 들어온다

여기서 많은 사람이 걸려 넘어진다. feature를 머지했다가 `revert -m 1`로 되돌렸다고 하자. 나중에 feature에서 작업을 더 한 뒤 다시 `main`에 머지하면, **이전에 되돌린 변경은 돌아오지 않고 새 커밋만 들어온다.**

![revert한 브랜치를 다시 머지하면 변경이 빠진다](/assets/posts/git-revert-merge-issue-retrap.svg)

이유는 Git의 머지 방식에 있다. 머지는 "두 브랜치의 공통 조상 이후 커밋"을 합친다. feature의 커밋들은 이미 한 번 `main`에 도달한 적이 있으므로, Git은 그것들을 "이미 반영됨"으로 본다. 그런데 그 변경을 revert로 지워 버렸으니, 결과적으로 *반영된 적은 있지만 실제로는 사라진* 모순된 상태가 된다. 다시 머지해도 Git은 옛 커밋을 다시 가져오지 않는다.

## 해결책: revert를 되돌리기

해법은 **그 revert 커밋 자체를 다시 revert**해서 변경을 되살리는 것이다.

```bash
# 1) 예전에 feature 변경을 지웠던 revert 커밋을 찾는다
git log --oneline --grep="Revert"

# 2) 그 revert를 되돌려 feature 변경을 복원
git revert <revert-commit-sha>

# 3) 이후 feature에서 추가 작업을 이어 머지
git merge feature
```

`revert`를 한 번 더 `revert`하면 원래 변경이 복원되므로, 그 위에서 feature의 새 작업을 정상적으로 머지할 수 있다. 다소 우회적이지만 히스토리를 다시 쓰지 않고 푸는 가장 안전한 방법이다.

## 더 깔끔한 대안

상황에 따라서는 처음부터 다른 접근이 나을 수 있다.

- **feature 브랜치를 새로 따기.** 문제의 feature를 버리고 새 브랜치에서 작업을 다시 모아 머지하면, "이미 반영됨" 판정을 피할 수 있다.
- **rebase로 재정렬.** 공유 전이라면 feature를 최신 `main` 위로 리베이스해 깨끗한 커밋으로 다시 올린다.

```bash
# 새 브랜치로 변경을 모아 다시 머지하는 패턴
git switch -c feature-redo origin/main
git cherry-pick <needed-commits>
git switch main && git merge feature-redo
```

정리하면, 머지 커밋 revert는 **`-m`으로 mainline을 지정**하는 것이 1차 관문이고, 되돌린 브랜치를 다시 살릴 때는 **revert를 되돌리거나 새 브랜치로 우회**하는 것이 핵심이다. 다음 글에서는 이런 머지 사고 자체를 줄이는 정책, fast-forward only 전략을 다룬다.

---

**지난 글:** [파일명 대소문자 문제 다루기](/posts/git-case-sensitivity/)

**다음 글:** [Fast-forward only 정책으로 선형 히스토리 유지하기](/posts/git-fast-forward-only-policy/)

<br>
읽어주셔서 감사합니다. 😊
