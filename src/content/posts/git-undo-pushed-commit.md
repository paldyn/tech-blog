---
title: "이미 푸시한 커밋을 안전하게 되돌리기"
description: "원격에 푸시한 커밋을 되돌리는 두 가지 전략(revert로 취소 커밋 추가, reset 후 force-with-lease)의 차이와 위험성, 공유 브랜치에서 협업자를 보호하는 결정 흐름, 강제 푸시 시 안전장치를 설명한다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "revert", "force-push", "되돌리기", "협업", "원격"]
featured: false
draft: false
---

[지난 글](/posts/git-undo-last-commit/)에서 로컬 커밋을 amend·reset·revert로 되돌리는 법을 다뤘다. 그런데 이미 `git push`로 원격에 올려 버렸다면 이야기가 달라진다. 다른 사람이 그 커밋을 이미 받아 갔을 수 있기 때문이다. 공유된 히스토리를 함부로 다시 쓰면 협업자의 저장소가 충돌하고, 작업이 유실되는 사고로 이어진다. 이번 글은 "푸시한 다음 잘못을 깨달았을 때" 무엇을 해야 하는지에 집중한다.

## 핵심 원칙: 공유된 히스토리는 다시 쓰지 않는다

푸시한 커밋을 되돌리는 길은 둘이다. 둘의 차이는 **히스토리를 보존하느냐, 잘라내느냐**에 있다.

![revert와 reset+force의 차이](/assets/posts/git-undo-pushed-commit-compare.svg)

`revert`는 기존 커밋을 그대로 두고 그 변경을 취소하는 새 커밋을 추가한다. 히스토리가 한 줄로 이어지므로 협업자가 그냥 `pull`만 하면 된다. 반면 `reset` 후 강제 푸시는 커밋을 통째로 잘라내고 원격을 덮어쓴다. 그 커밋 위에서 작업하던 동료의 히스토리는 졸지에 갈라져, 다음에 푸시할 때 충돌하거나 최악의 경우 작업을 잃는다.

## 권장: revert로 취소 커밋 추가

대부분의 경우 정답은 `revert`다.

```bash
# 특정 커밋의 변경을 취소하는 새 커밋 생성 후 푸시
git revert <commit-sha>
git push origin main
```

여러 커밋을 한꺼번에 되돌릴 수도 있다. 범위를 주면 각각에 대한 취소 커밋이 순서대로 만들어진다.

```bash
# 최근 3개 커밋을 되돌리되, 하나의 커밋으로 묶고 싶다면
git revert --no-commit HEAD~3..HEAD
git commit -m "revert: 최근 3개 변경 일괄 취소"
```

`--no-commit`은 되돌림을 스테이징만 하고 커밋은 보류한다. 마지막에 직접 커밋하면 여러 되돌림을 하나로 합칠 수 있다.

## 결정 흐름: 누가 보고 있는가

선택의 출발점은 언제나 "이 브랜치를 다른 사람이 받아 갔는가"라는 질문이다.

![되돌리기 방법 결정 흐름](/assets/posts/git-undo-pushed-commit-decision.svg)

- **다른 사람이 받아 갔다 → revert.** 안전하고 협업 친화적이다.
- **혼자 쓰는 브랜치(개인 feature 등)다 → reset 후 안전한 강제 푸시.**

## 부득이하게 히스토리를 고쳐야 한다면

방금 푸시한 비밀정보를 지워야 하거나, 혼자 쓰는 브랜치를 정리하는 경우처럼 히스토리를 다시 써야만 할 때가 있다. 이때는 `--force` 대신 반드시 `--force-with-lease`를 쓴다.

```bash
# 커밋을 잘라낸 뒤
git reset --hard HEAD~1

# 그냥 --force가 아니라 --force-with-lease로!
git push --force-with-lease origin feature-branch
```

`--force-with-lease`는 "내가 마지막으로 본 원격 상태와 지금 원격이 같을 때만 덮어쓰라"는 안전장치다. 그 사이 누군가 푸시했다면 거부되므로, 동료의 커밋을 모르고 짓밟는 사고를 막아 준다. 단순 `--force`는 이 검증을 건너뛰므로 팀 작업에서는 피해야 한다.

강제 푸시를 했다면 팀에 알리는 것이 예의다. 그 브랜치를 받아 간 동료는 자신의 로컬을 원격에 맞춰 재설정해야 한다.

```bash
# 동료가 강제 푸시된 브랜치를 따라잡는 안전한 방법
git fetch origin
git reset --hard origin/feature-branch   # 로컬 변경 없을 때만
```

정리하면, 푸시한 커밋은 **revert가 기본, 강제 푸시는 예외**다. 그리고 강제 푸시를 할 때조차 `--force-with-lease`로 안전망을 두는 습관이 사고를 막는다. 다음 글에서는 "맞는 작업을 엉뚱한 브랜치에 커밋했을 때" 커밋을 올바른 곳으로 옮기는 방법을 다룬다.

---

**지난 글:** [마지막 커밋 되돌리기: amend · reset · revert 골라 쓰기](/posts/git-undo-last-commit/)

**다음 글:** [엉뚱한 브랜치에 커밋했을 때 바로잡기](/posts/git-fix-wrong-branch-commit/)

<br>
읽어주셔서 감사합니다. 😊
