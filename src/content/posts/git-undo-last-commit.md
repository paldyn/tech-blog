---
title: "마지막 커밋 되돌리기: amend · reset · revert 골라 쓰기"
description: "방금 만든 커밋을 되돌리는 세 가지 방법(amend로 고쳐 쓰기, reset으로 제거하기, revert로 취소 커밋 추가하기)의 차이와 reset의 soft·mixed·hard 모드가 건드리는 범위, 푸시 여부에 따른 선택 기준을 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "reset", "revert", "amend", "되돌리기", "커밋"]
featured: false
draft: false
---

[지난 글](/posts/git-range-diff/)에서 다시 쓴 커밋을 비교하는 range-diff를 다뤘다. 이번에는 가장 흔한 실수, "방금 만든 커밋을 되돌리고 싶다"는 상황을 정리한다. 메시지에 오타가 났거나, 파일 하나를 빠뜨렸거나, 아예 커밋 자체를 없던 일로 하고 싶을 수 있다. 상황마다 맞는 도구가 다르고, 잘못 고르면 작업 내용을 통째로 날릴 수도 있으니 차이를 분명히 알아 두자.

## 세 가지 도구, 세 가지 결과

마지막 커밋을 되돌리는 방법은 크게 세 갈래다. **무엇을 보존하고 무엇을 버릴지**가 선택의 기준이다.

![amend·reset·revert 세 갈래 비교](/assets/posts/git-undo-last-commit-options.svg)

- **amend**: 직전 커밋을 *고쳐 쓴다*. 메시지나 빠뜨린 파일을 추가할 때.
- **reset**: 커밋을 *히스토리에서 제거한다*. 로컬 정리에 적합.
- **revert**: 변경을 취소하는 *새 커밋을 추가한다*. 이미 공유된 경우에 안전.

## amend: 직전 커밋 고쳐 쓰기

가장 가벼운 수정이다. 메시지만 고치려면 다음과 같다.

```bash
# 메시지만 수정
git commit --amend -m "fix: 올바른 커밋 메시지"
```

파일을 빠뜨렸다면 먼저 스테이징한 뒤 amend한다. `--no-edit`을 붙이면 메시지는 그대로 두고 내용만 합친다.

```bash
git add forgotten-file.js
git commit --amend --no-edit
```

주의할 점: amend는 사실 *새 커밋을 만들어 기존 커밋을 대체*하는 것이라 SHA가 바뀐다. 이미 푸시한 커밋을 amend하면 원격과 히스토리가 어긋나므로, 아직 푸시하지 않은 커밋에만 쓰는 것이 안전하다.

## reset: 커밋을 통째로 제거

커밋 자체를 없애려면 `git reset`을 쓴다. 핵심은 세 가지 모드이며, 각각 **HEAD·스테이징·작업 트리** 중 어디까지 되돌릴지가 다르다.

![reset soft·mixed·hard가 건드리는 범위](/assets/posts/git-undo-last-commit-reset-modes.svg)

```bash
# soft: 커밋만 취소, 변경은 스테이징에 그대로 (재커밋 직전 상태)
git reset --soft HEAD~1

# mixed(기본): 커밋·스테이징 취소, 변경은 작업 트리에 남음
git reset HEAD~1

# hard: 커밋·스테이징·작업 트리 모두 되돌림 — 변경 내용 사라짐
git reset --hard HEAD~1
```

`--soft`는 "커밋 메시지를 다시 쓰고 싶다"거나 "여러 커밋을 하나로 합치고 싶다"는 경우에 유용하다. 변경이 고스란히 스테이징에 남아 곧바로 다시 커밋할 수 있기 때문이다.

`--hard`는 강력하지만 위험하다. 작업 트리의 변경까지 지우므로, 아직 커밋하지 않은 작업이 함께 날아갈 수 있다. 실수했더라도 커밋된 적이 있는 내용은 `git reflog`로 복구할 수 있지만, 한 번도 커밋하지 않은 변경은 되살릴 수 없다.

## revert: 취소 커밋 추가하기

이미 푸시해서 동료가 받아 갔다면 `reset`은 위험하다. 히스토리가 갈라져 협업자의 저장소와 충돌하기 때문이다. 이럴 때는 `revert`로 **변경을 되돌리는 새 커밋을 추가**한다.

```bash
# 마지막 커밋의 변경을 취소하는 새 커밋 생성
git revert HEAD
```

revert는 기존 커밋을 건드리지 않고 그 위에 "되돌림" 커밋을 쌓으므로, 히스토리가 보존되고 협업자와 충돌하지 않는다. 공유된 브랜치에서 무언가를 되돌릴 때의 기본 선택지다.

## 어느 것을 골라야 하나

판단은 두 질문으로 정리된다.

1. **이미 푸시했는가?** 그렇다면 `revert`. 공유된 히스토리는 다시 쓰지 않는다.
2. **아직 로컬인가?** 메시지·파일 보강이면 `amend`, 커밋 자체를 없애려면 `reset`.

```bash
# 안전 점검: 무엇을 되돌리는지 먼저 확인
git log --oneline -3
git show HEAD --stat
```

되돌리기 전에 `git log`로 대상을 한 번 더 확인하는 습관을 들이면 실수가 크게 준다. 다음 글에서는 이미 원격에 푸시해 버린 커밋을 동료에게 피해를 주지 않고 되돌리는 방법을 더 깊이 파고든다.

---

**지난 글:** [git range-diff: 리베이스 전후 커밋을 짝지어 비교하기](/posts/git-range-diff/)

**다음 글:** [이미 푸시한 커밋을 안전하게 되돌리기](/posts/git-undo-pushed-commit/)

<br>
읽어주셔서 감사합니다. 😊
