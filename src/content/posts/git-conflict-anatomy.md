---
title: "Git 충돌의 해부: 언제, 왜 발생하는가"
description: "Git 충돌이 발생하는 세 가지 상황(merge, rebase, cherry-pick)과 충돌 중 파일 상태, 해결 원칙을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "충돌", "conflict", "merge", "rebase"]
featured: false
draft: false
---

[지난 글](/posts/git-cherry-pick-conflict/)에서 cherry-pick 중 충돌이 발생했을 때의 처리 흐름을 살펴봤다. 이번 글에서는 더 넓은 시야로 **Git 충돌이 발생하는 조건과 구조**를 파악한다. 충돌을 두려워하지 않으려면 왜 생기는지부터 이해해야 한다.

## 충돌의 본질

Git은 두 개의 변경사항이 **같은 파일의 같은 위치(줄)**를 서로 다르게 수정했을 때 어느 쪽을 선택해야 할지 스스로 결정하지 않는다. 대신 작업을 멈추고 사람에게 판단을 넘긴다. 이것이 충돌이다.

반대로, 두 브랜치가 **같은 파일이라도 다른 줄**을 수정했다면 Git은 자동으로 합쳐준다. 충돌은 "같은 줄 동시 수정"이라는 조건에서만 발생한다.

## 충돌이 발생하는 세 가지 상황

![Git 충돌이 발생하는 세 가지 상황](/assets/posts/git-conflict-anatomy-causes.svg)

### merge 충돌

```bash
git merge feature
# CONFLICT (content): Merge conflict in src/auth.py
```

`main`과 `feature`가 `src/auth.py`의 같은 줄을 다르게 수정한 채 병합을 시도하면 충돌이 난다. 3-way merge 알고리즘이 공통 조상(Base)을 찾아 양쪽 변경을 비교하는데, 같은 위치에서 양쪽 모두 달라졌으면 병합이 불가능하다.

### rebase 충돌

```bash
git rebase main
# CONFLICT (content): Merge conflict in src/auth.py
```

rebase는 커밋을 하나씩 재적용한다. 각 커밋을 적용할 때마다 현재 base와 충돌이 있는지 검사한다. 커밋이 10개라면 최악의 경우 충돌도 10번 발생할 수 있다.

### cherry-pick 충돌

```bash
git cherry-pick abc1234
# CONFLICT (content): Merge conflict in src/auth.py
```

cherry-pick은 원본 커밋이 만들어낸 diff를 현재 브랜치에 강제로 적용한다. 현재 브랜치가 원본보다 많이 앞서 나갔다면 같은 줄이 이미 다른 상태가 되어 충돌 가능성이 높다.

## 충돌 중 파일 상태

충돌이 발생하면 `git status`를 통해 세 종류의 파일 상태를 확인할 수 있다.

![충돌 중 파일 상태와 해결 방법](/assets/posts/git-conflict-anatomy-states.svg)

- **Unmerged paths**: 충돌이 남아 있는 파일. 반드시 해결해야 한다.
- **Changes to be committed**: 이미 해결 완료된 파일.
- **Changes not staged**: 충돌과 무관한 일반 변경 파일.

`Unmerged paths`에 파일이 하나라도 있으면 커밋할 수 없다. 모두 해결한 뒤 `git add`로 올려야 한다.

```bash
git status               # 미해결 파일 확인
git diff                 # 충돌 마커가 있는 내용 확인
git diff --diff-filter=U # 충돌 파일만 필터링
```

## 충돌 상태를 나타내는 플래그

Git은 충돌 상태를 내부적으로 특수 파일로 기록한다.

```bash
cat .git/MERGE_HEAD        # merge 충돌 중이면 존재
cat .git/REBASE_HEAD       # rebase 충돌 중이면 존재
cat .git/CHERRY_PICK_HEAD  # cherry-pick 충돌 중이면 존재
```

이 파일이 존재하는 동안은 진행 중인 작업이 있다는 뜻이다. `--abort`를 실행하면 이 파일이 제거되고 이전 상태로 돌아간다.

## 충돌 해결의 세 원칙

1. **완전히 수정하라**: 마커(`<<<<<<<`, `=======`, `>>>>>>>`)를 파일에 남기지 않는다.
2. **확인 후 add하라**: 파일 전체를 git add하기 전에 내용이 올바른지 검토한다.
3. **쉬운 것부터**: 여러 파일에 충돌이 있을 때, 간단한 파일부터 해결하면 큰 그림이 보인다.

충돌은 Git이 사람에게 판단을 요청하는 신호다. 당황하지 말고 `git status`로 범위를 파악하고 한 파일씩 해결하면 된다.

---

**지난 글:** [Cherry-pick 충돌: 발생부터 해결까지](/posts/git-cherry-pick-conflict/)

**다음 글:** [충돌 마커 해설: &#60;&#60;&#60;&#60;&#60;&#60;&#60;, =======, &#62;&#62;&#62;&#62;&#62;&#62;&#62;](/posts/git-conflict-markers/)

<br>
읽어주셔서 감사합니다. 😊
