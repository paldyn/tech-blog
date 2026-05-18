---
title: "git rebase -i — squash와 fixup으로 히스토리 정리"
description: "git rebase -i의 squash와 fixup 명령어로 여러 WIP 커밋을 깔끔한 하나의 커밋으로 합치는 방법, 실전 워크플로를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "rebase", "interactive", "squash", "fixup", "히스토리 정리", "WIP"]
featured: false
draft: false
---

[지난 글](/posts/git-amend-pitfalls/)에서 amend의 주의사항을 살펴봤다. 이번에는 한 단계 더 나아가 **여러 커밋을 합치거나 정리**하는 `git rebase -i`의 squash와 fixup을 다룬다. feature 브랜치에서 WIP 커밋을 잔뜩 만들고 PR 전에 깔끔하게 정리하는 핵심 도구다.

## squash와 fixup의 차이

`git rebase -i`(interactive rebase)는 커밋 목록을 에디터로 열어 각 커밋에 명령을 지정한다.

- **pick(p)**: 커밋을 그대로 사용
- **squash(s)**: 앞 pick 커밋과 합치되, 이 커밋의 메시지도 최종에 포함
- **fixup(f)**: 앞 pick 커밋과 합치되, 이 커밋의 메시지는 버림

fixup이 "조용한 squash"다. 오타 수정, 디버그 코드 제거 같은 작은 수정은 fixup으로 메시지 없이 합치고, 의미 있는 변경 단위는 squash로 메시지를 보존한다.

![squash vs fixup 비교](/assets/posts/git-rebase-squash-fixup-concept.svg)

## 기본 사용법

```bash
# 마지막 4개 커밋을 인터랙티브 편집
git rebase -i HEAD~4

# 특정 커밋 이후부터 편집
git rebase -i abc1234^

# main과 분기한 이후 모든 커밋 편집
git rebase -i origin/main
```

명령을 실행하면 에디터가 열리고 커밋 목록이 오래된 순서(위)부터 나온다. `git log`와 순서가 반대임에 주의한다.

![rebase -i 에디터 화면](/assets/posts/git-rebase-squash-fixup-editor.svg)

## 실전 워크플로: PR 전 커밋 정리

feature 브랜치에서 개발하다 보면 아래 같은 히스토리가 쌓인다.

```
abc1234 feat: add user authentication
def5678 wip: save progress
ghi9abc fix: typo in auth handler
jkl0123 debug: add console.log
mno4567 fix: remove debug log
```

이것을 PR 전에 정리한다.

```bash
git rebase -i origin/main
```

에디터에서:

```
pick abc1234 feat: add user authentication
squash def5678 wip: save progress
fixup ghi9abc fix: typo in auth handler
fixup jkl0123 debug: add console.log
fixup mno4567 fix: remove debug log
```

저장하면 squash된 커밋들의 메시지를 합칠 수 있는 에디터가 다시 열린다. 최종 메시지를 정리하고 저장하면 아래처럼 한 커밋이 된다.

```
xyz7890 feat: add user authentication
```

## --autosquash 옵션

커밋 메시지에 `fixup!` 또는 `squash!` 접두어를 붙이면 `--autosquash`가 자동으로 배치해준다.

```bash
# WIP 커밋 정리용 fixup 커밋 만들기
git commit -m "fixup! feat: add user authentication"

# rebase 시 자동 정렬
git rebase -i --autosquash origin/main
```

`fixup! <기존 커밋 메시지>`로 시작하는 커밋은 rebase -i 에디터에서 자동으로 해당 커밋 바로 아래 `fixup`으로 배치된다. 매번 에디터에서 줄을 이동할 필요가 없다.

```bash
# 항상 autosquash 적용하도록 설정
git config --global rebase.autoSquash true
```

## 빠른 fixup 워크플로

```bash
# 수정 사항 스테이징
git add -p

# fixup 커밋 (autosquash와 연동)
git commit --fixup HEAD~2

# 또는 특정 커밋에 fixup 연결
git commit --fixup abc1234

# 정리
git rebase -i --autosquash origin/main
```

`git commit --fixup <sha>`는 자동으로 `fixup! <해당 커밋 메시지>`를 메시지로 붙여준다.

## 충돌 처리

rebase 중 충돌이 생기면 멈추고 알려준다.

```bash
# 충돌 발생 시
# CONFLICT (content): Merge conflict in src/auth.js

# 수동으로 충돌 해결 후
git add src/auth.js

# rebase 계속
git rebase --continue

# 포기하고 원래 상태로
git rebase --abort
```

squash/fixup 중 충돌이 생기면 어떤 커밋들이 합쳐지는 중인지 파악하고 신중하게 해결한다.

## rebase 이후 force push

rebase -i는 SHA를 바꾸므로 이미 push한 브랜치라면 force push가 필요하다.

```bash
git push --force-with-lease origin feature/auth
```

이 역시 혼자만 쓰는 feature 브랜치에서만 해야 한다. 팀원이 해당 브랜치를 pull해서 작업 중이라면 사전에 조율이 필요하다.

---

**지난 글:** [git commit --amend 주의사항과 실수 복구](/posts/git-amend-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
