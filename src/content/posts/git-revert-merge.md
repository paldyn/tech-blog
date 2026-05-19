---
title: "git revert — 머지 커밋 되돌리기"
description: "git revert -m 옵션으로 머지 커밋을 되돌리는 방법, parent 번호 의미, revert 후 재머지 시 발생하는 함정과 해결법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "revert", "머지 커밋", "-m 옵션", "히스토리"]
featured: false
draft: false
---

[지난 글](/posts/git-revert/)에서 일반 커밋을 revert하는 방법을 배웠다. 이번에는 더 까다로운 경우인 **머지 커밋(merge commit) revert**를 다룬다. 머지 커밋은 두 개의 부모를 갖기 때문에 `git revert`에 `-m` 옵션을 반드시 지정해야 한다.

## 머지 커밋이 다른 이유

일반 커밋은 부모가 하나다. 머지 커밋은 두 브랜치를 합친 결과라서 부모가 둘이다. Git은 "이 커밋을 revert할 때 어느 부모 상태로 돌아갈 것인가?"를 알아야 하므로, `-m <parent-number>`로 기준 부모를 지정해야 한다.

![머지 커밋 revert 개념](/assets/posts/git-revert-merge-concept.svg)

## -m 옵션 이해하기

```bash
# 머지 커밋의 부모 목록 확인
git log --pretty=format:"%H %P" -1 MergeSHA
# abc123 (머지커밋SHA)   def456 (parent1)   ghi789 (parent2)

# 대부분의 경우: main으로 feature를 머지했다면
# parent 1 = main, parent 2 = feature
git revert -m 1 MergeSHA
```

`-m 1`은 "parent 1(main) 상태로 되돌려라", 즉 feature 브랜치의 변경을 취소하는 의미다.

```bash
# parent 번호를 잘 모를 때 확인하는 방법
git show MergeSHA
# Merge: def456 ghi789
# 왼쪽이 parent 1, 오른쪽이 parent 2
```

## 실전 워크플로

배포 후 feature 브랜치가 문제를 일으켰다고 가정한다.

```bash
# 문제의 머지 커밋 SHA 찾기
git log --oneline --merges -10

# 머지 커밋 revert
git revert -m 1 abc1234 --no-edit

# main에 push
git push origin main
```

이렇게 하면 feature 브랜치의 변경사항이 취소된 상태가 된다.

## revert 후 재머지 함정

머지 커밋을 revert한 뒤 버그를 수정한 feature 브랜치를 다시 머지하면 **원래 변경사항이 다시 적용되지 않는다**. Git 입장에서는 이미 한 번 머지됐던 커밋들이라 새로 반영할 게 없다고 판단한다.

![revert 후 재머지 해결법](/assets/posts/git-revert-merge-remerge.svg)

이를 해결하는 표준 패턴은 "revert의 revert"다.

```bash
# 1. 머지 커밋 revert (버그 제거)
git revert -m 1 MergeSHA

# 2. feature 브랜치에서 버그 수정
git checkout feature
git commit -m "fix: 프로덕션 버그 수정"
git checkout main

# 3. revert 커밋 자체를 다시 revert
git revert RevertCommitSHA

# 4. 수정된 feature 재머지
git merge feature
```

3단계가 핵심이다. "revert한 것을 되돌린다"는 것은 원래 feature의 변경사항을 다시 활성화하는 의미다. 그 위에 버그 수정 커밋이 더해진 feature를 머지하면 완성된다.

## 주의: --no-commit과 함께 사용 가능

```bash
# 즉시 커밋하지 않고 스테이징만
git revert -m 1 --no-commit MergeSHA

# 내용 검토 후 커밋
git diff --staged
git commit -m "revert: feature/bad-feature 머지 취소"
```

## parent 번호를 잘못 지정하면

`-m 2`를 잘못 지정하면 main의 변경사항이 취소되는 정반대 효과가 난다. 반드시 `git show MergeSHA`로 parent 순서를 확인한다.

```bash
# parent 순서 확인
git show --no-patch --format="Merge: %P" MergeSHA
# Merge: abc123 def456
# → abc123이 parent 1, def456이 parent 2
```

일반적으로 feature 브랜치를 main에 머지한 경우 parent 1이 main이므로 `-m 1`이 맞다.

---

**지난 글:** [git revert — 안전하게 커밋 되돌리기](/posts/git-revert/)

**다음 글:** [git 커밋 작성자 일괄 수정](/posts/git-rewrite-author/)

<br>
읽어주셔서 감사합니다. 😊
