---
title: "git rebase -i — drop으로 커밋 삭제"
description: "git rebase -i의 drop 명령으로 불필요한 커밋을 히스토리에서 완전히 제거하는 방법, revert와의 차이, 안전한 사용 패턴을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "rebase", "interactive", "drop", "히스토리 삭제"]
featured: false
draft: false
---

[지난 글](/posts/git-rebase-reorder/)에서 커밋 순서를 바꾸는 방법을 살펴봤다. 이번에는 `git rebase -i`의 `drop` 명령으로 **커밋 자체를 히스토리에서 완전히 삭제**하는 방법을 다룬다. 디버그 로그, 임시 파일, 실수로 포함된 커밋을 깔끔하게 지울 때 쓴다.

## drop이란

`git rebase -i` 에디터에서 커밋 앞의 `pick`을 `drop`(또는 `d`)으로 바꾸면, 해당 커밋이 재생(replay) 목록에서 빠진다. 결과적으로 그 커밋의 변경사항은 히스토리에서 사라진다.

![drop으로 커밋 삭제 개념](/assets/posts/git-rebase-drop-commit-concept.svg)

## 기본 사용법

```bash
# 마지막 4개 커밋 편집
git rebase -i HEAD~4
```

에디터가 열리면:

```
pick abc111 feat: 로그인
drop def222 debug: console.log 추가
pick ghi333 fix: 버그 수정
drop jkl444 temp: 임시 파일
```

`def222`와 `jkl444` 앞을 `drop`으로 바꾼 뒤 저장하면 두 커밋이 히스토리에서 사라진다.

![drop 명령어 세 가지 표기법](/assets/posts/git-rebase-drop-commit-editor.svg)

## 줄 자체를 삭제해도 된다

`drop`을 명시하는 대신 해당 줄을 에디터에서 통째로 지워도 동일하다.

```bash
# vim에서 해당 줄로 이동 후
dd  # 줄 삭제
```

`pick` 줄이 없다는 것은 해당 커밋을 재생하지 않겠다는 의미다.

## 단일 커밋 즉시 제거 — rebase --onto

`rebase -i`를 열지 않고 특정 커밋 하나만 제거할 때는 `--onto` 옵션을 쓴다.

```bash
# def222 커밋을 건너뛰고 rebase
git rebase --onto def222^ def222 HEAD
```

`def222^`에서 시작해 `def222`를 건너뛰고 `HEAD`까지 재적용하는 의미다. 복잡해 보이지만 "이 커밋만 빼고 나머지를 이어붙여라"는 단순한 개념이다.

## 충돌 처리

삭제한 커밋이 이후 커밋의 기반이라면 충돌이 난다.

```bash
# 충돌 해결 후
git add <파일>
git rebase --continue

# 전체 취소
git rebase --abort
```

drop 후 충돌이 자주 난다면 그 커밋이 다른 커밋의 전제 조건임을 의미한다. 이 경우 drop 대신 fixup으로 이전 커밋에 합치거나, squash로 메시지를 정리해 남기는 방안을 고려한다.

## drop vs revert: 언제 무엇을 쓰나

```bash
# drop: 히스토리에서 완전히 제거 (push 전 로컬에서)
git rebase -i HEAD~3
# → drop 지정

# revert: 되돌리기 커밋을 새로 추가 (push 후 공유 브랜치에서)
git revert def222
```

핵심 판단 기준은 **이미 push했는가**다. push 전이면 drop으로 깨끗하게 제거한다. push 후라면 force push가 필요하고, 팀원이 해당 커밋을 받았을 수 있으므로 revert를 쓴다.

| | drop | revert |
|---|---|---|
| 히스토리 흔적 | 없음 | 있음 (revert 커밋) |
| push 전 | 권장 | 가능하지만 불필요 |
| push 후 공유 브랜치 | 위험 (force push 필요) | 권장 |

## force push

drop은 SHA를 바꾸므로 이미 push한 브랜치라면 force push가 필요하다.

```bash
git push --force-with-lease origin feature/cleanup
```

`--force-with-lease`는 원격에 내가 모르는 새 커밋이 있으면 push를 거부해 안전하다. `--force`는 무조건 덮어쓰므로 팀 협업 시 `--force-with-lease`를 항상 사용한다.

---

**지난 글:** [git rebase -i — 커밋 순서 바꾸기](/posts/git-rebase-reorder/)

**다음 글:** [git filter-repo — 히스토리 완전 재작성](/posts/git-filter-repo/)

<br>
읽어주셔서 감사합니다. 😊
