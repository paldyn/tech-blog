---
title: "Interactive Rebase: 커밋 수정·합치기·순서 바꾸기"
description: "git rebase -i로 커밋 메시지 수정, squash/fixup 통합, 순서 변경, 커밋 분리까지 로컬 히스토리를 자유롭게 정리하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "rebase", "interactive", "squash", "fixup", "히스토리 정리"]
featured: false
draft: false
---

[지난 글](/posts/git-rebase-basics/)에서 rebase의 기본 원리를 살펴봤다. `git rebase -i`(인터랙티브 모드)는 로컬 커밋 히스토리를 직접 편집할 수 있는 강력한 도구다. PR을 제출하기 전 WIP 커밋들을 정리하거나, 잘못된 메시지를 수정하는 데 자주 쓴다.

## 인터랙티브 모드 시작

```bash
# 최근 5개 커밋을 편집 가능한 todo 리스트로 열기
git rebase -i HEAD~5

# 특정 커밋 이후의 모든 커밋
git rebase -i abc1234
```

에디터가 열리면 각 커밋 앞에 동작을 지정하는 키워드가 있다.

![Interactive Rebase Todo 리스트](/assets/posts/git-rebase-interactive-todolist.svg)

## 주요 명령어

| 명령 | 단축 | 설명 |
|------|------|------|
| `pick` | `p` | 커밋을 그대로 사용 |
| `reword` | `r` | 메시지만 수정 (내용은 유지) |
| `edit` | `e` | 커밋에서 멈추고 수동 수정 |
| `squash` | `s` | 이전 커밋에 합치기 (메시지 합침) |
| `fixup` | `f` | 이전 커밋에 합치기 (메시지 버림) |
| `drop` | `d` | 커밋 삭제 |

## squash: WIP 커밋 정리

```bash
pick a1b2c3d feat: 로그인 폼 구현
squash b2c3d4e fix: 오타 수정
squash c3d4e5f wip: 저장 진행중
```

세 번째 커밋 앞을 `squash`로 바꾸면 세 커밋이 하나로 합쳐지고, Git이 커밋 메시지를 어떻게 합칠지 물어본다. `fixup`은 첫 번째 커밋 메시지만 사용하고 나머지를 버린다.

## reword: 메시지만 고치기

```bash
pick a1b2c3d feat: 로그인 구현
reword d4e5f6a feat: 비번
```

`reword`로 바꾸면 해당 커밋 적용 시 메디터가 열려 메시지를 수정한다. 코드는 그대로다.

## drop: 커밋 제거

```bash
drop b2c3d4e 디버그 코드 임시 추가
```

해당 줄 자체를 삭제해도 동일한 효과다. 커밋이 히스토리에서 사라진다.

## 순서 변경

todo 리스트에서 줄 자체를 잘라 붙여넣기만 해도 커밋 순서가 바뀐다. 단, 이후 커밋이 앞 커밋에 의존하면 충돌이 발생할 수 있다.

## edit: 커밋 분리하기

하나의 커밋에 너무 많은 변경이 섞였을 때 커밋을 둘로 나눌 수 있다.

```bash
# todo에서 pick → edit 로 변경 후 저장
# Git이 해당 커밋 직후에서 멈춤

git reset HEAD~       # 커밋 취소, 변경은 워킹트리에 유지
git add -p            # 일부만 선택 스테이징
git commit -m "파트1"
git add .
git commit -m "파트2"
git rebase --continue  # 나머지 커밋 진행
```

![edit 명령과 autosquash](/assets/posts/git-rebase-interactive-edit.svg)

## --autosquash: fixup! 접두어 자동 인식

```bash
# 나중에 정리할 커밋을 fixup! 접두어로 만들기
git commit -m "fixup! feat: 로그인 폼 구현"

# 인터랙티브 rebase 시 자동 정렬 + fixup 적용
git rebase -i --autosquash HEAD~5
```

`fixup! 원래커밋메시지` 형식으로 커밋을 만들어두면, `--autosquash`가 자동으로 해당 커밋 다음에 배치하고 `fixup`으로 설정한다. `squash! ...` 접두어도 동일하게 동작한다.

## 주의사항

- push된 브랜치를 rebase하면 force push가 필요하다. 팀원이 있는 공유 브랜치에서는 금지
- rebase -i 중 언제든 `git rebase --abort`로 원 상태로 돌아갈 수 있다

---

**지난 글:** [Rebase 기초: 커밋을 새 베이스 위에 재적용하기](/posts/git-rebase-basics/)

**다음 글:** [rebase --onto: 특정 범위 커밋만 옮기기](/posts/git-rebase-onto/)

<br>
읽어주셔서 감사합니다. 😊
