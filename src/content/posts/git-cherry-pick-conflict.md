---
title: "Cherry-pick 충돌: 발생부터 해결까지"
description: "cherry-pick 중 충돌이 발생하는 원인과 --continue, --abort, --skip 옵션으로 충돌을 처리하는 전체 흐름을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "cherry-pick", "충돌", "conflict", "브랜치"]
featured: false
draft: false
---

[지난 글](/posts/git-cherry-pick/)에서 `git cherry-pick`으로 특정 커밋만 골라 적용하는 방법을 배웠다. cherry-pick은 강력하지만, 대상 커밋의 변경 내용이 현재 브랜치의 코드와 충돌할 때 중간에 멈춘다. 이번 글에서는 충돌이 발생하는 이유와 이를 처리하는 전체 흐름을 정리한다.

## 왜 충돌이 발생하는가

cherry-pick은 지정한 커밋이 "만들어낸 diff"를 현재 브랜치에 재적용한다. 원본 커밋이 만들어진 시점과 지금 브랜치의 상태가 다르면, 동일한 위치에 이미 다른 변경이 존재할 수 있다. Git이 두 변경사항을 자동으로 합치지 못하면 충돌이 생긴다.

```
feature: A → B → C(충돌 대상)
main:    A → B → D → E  ← E에서 C와 같은 줄을 이미 수정했다면?
```

cherry-pick C를 main에 적용할 때 E의 수정과 C의 수정이 같은 줄을 건드리면 충돌이 발생한다.

## 충돌 시 Git의 반응

충돌이 생기면 cherry-pick 작업이 중단되고 터미널에 다음과 같은 메시지가 나타난다.

```
error: could not apply abc1234... fix: 인증 토큰 만료 버그
hint: After resolving the conflicts, mark them with
hint: "git add/rm <pathspec>", then run
hint: "git cherry-pick --continue".
hint: You can instead skip this commit: run "git cherry-pick --skip".
hint: To abort and get back to the state before "git cherry-pick",
hint: run "git cherry-pick --abort".
```

`git status`를 실행하면 `both modified: src/auth.py` 같은 형태로 충돌 파일 목록이 보인다.

## 해결 흐름

![Cherry-pick 충돌 해결 흐름](/assets/posts/git-cherry-pick-conflict-flow.svg)

### 1단계: 충돌 파일 편집

충돌 파일을 열면 `<<<<<<<`, `=======`, `>>>>>>>` 마커로 나뉜 구역이 보인다. 원하는 최종 내용으로 직접 편집한 뒤 마커를 모두 제거한다.

```python
# 충돌 전 파일 예시
<<<<<<< HEAD
token_expiry = 3600
=======
token_expiry = 7200  # cherry-pick 커밋의 변경
>>>>>>> abc1234 (fix: 인증 토큰 만료 버그)
```

마커를 제거하고 올바른 값을 남긴다.

### 2단계: 스테이지에 추가

수정이 끝난 파일을 스테이지에 올린다.

```bash
git add src/auth.py
```

충돌이 있는 파일 전체를 한 번에 올릴 수도 있다.

```bash
git add .
```

### 3단계: cherry-pick 재개

```bash
git cherry-pick --continue
```

커밋 메시지 편집기가 열린다. 원본 커밋 메시지가 기본값으로 채워지며, 그대로 저장하거나 수정할 수 있다.

![충돌 해결 핵심 명령어](/assets/posts/git-cherry-pick-conflict-commands.svg)

## 작업 중단하기 — --abort

충돌이 복잡하거나 지금 해결할 수 없다면 `--abort`로 작업 전체를 취소한다.

```bash
git cherry-pick --abort
```

작업 디렉토리와 인덱스가 cherry-pick 시작 이전 상태로 완전히 복구된다.

## 이 커밋만 건너뛰기 — --skip

범위 cherry-pick (`abc^..def`)을 실행하다가 특정 커밋만 건너뛰고 싶을 때 사용한다.

```bash
git cherry-pick --skip
```

주의할 점: `--skip`은 해당 커밋의 변경사항을 포기하는 것이다. 변경이 필요 없다고 확신할 때만 사용한다.

## 상태 복구 팁 — --quit

`--abort`는 전체를 되돌리지만, `--quit`는 cherry-pick 상태(`.git/CHERRY_PICK_HEAD`)만 초기화하고 워킹 트리의 변경사항은 유지한다. 충돌 해결 도중 일시적으로 다른 작업을 해야 할 때 유용하다.

```bash
git cherry-pick --quit   # 상태 초기화, 수정 파일은 그대로
```

## 충돌 예방을 위한 팁

- `git log --oneline origin/feature..HEAD` 로 픽하려는 커밋과 현재 브랜치의 차이를 미리 확인한다.
- `-n`(no-commit) 옵션으로 우선 스테이지에만 올려 diff를 검토한 뒤 커밋한다.

```bash
git cherry-pick -n abc1234    # 커밋하지 않고 스테이지만
git diff --staged             # 충돌 전 내용 미리 확인
```

---

**지난 글:** [Cherry-pick: 특정 커밋만 골라서 적용하기](/posts/git-cherry-pick/)

**다음 글:** [Git 충돌의 해부: 언제, 왜 발생하는가](/posts/git-conflict-anatomy/)

<br>
읽어주셔서 감사합니다. 😊
