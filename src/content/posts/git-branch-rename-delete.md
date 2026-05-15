---
title: "브랜치 이름 변경과 삭제: git branch -m/-d/-D"
description: "git branch -m으로 로컬·원격 브랜치 이름을 변경하고, -d/-D로 안전·강제 삭제하는 전체 흐름과 주의점을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "git branch", "브랜치 삭제", "브랜치 이름 변경", "-m -d -D"]
featured: false
draft: false
---

[지난 글](/posts/git-branch-list-create/)에서 브랜치를 만들고 목록을 보는 법을 다뤘다. 이번에는 브랜치 이름을 바꾸고 삭제하는 방법을 살펴본다. 원격 브랜치가 얽히면 단계가 늘어나므로 순서를 명확히 이해해야 한다.

## 브랜치 이름 변경

```bash
# 다른 브랜치 이름 변경
git branch -m old-name new-name

# 현재 체크아웃된 브랜치 이름 변경 (인수 1개)
git branch -m new-name
```

로컬 이름만 바뀐다. 원격에 이미 push된 브랜치라면 추가 작업이 필요하다.

![브랜치 이름 변경과 삭제 명령](/assets/posts/git-branch-rename-delete-commands.svg)

## 원격 브랜치 이름 변경 전체 흐름

원격 저장소는 브랜치 파일을 직접 수정할 수 없다. 새 이름으로 push하고 구 이름을 삭제하는 방식으로 처리한다.

```bash
# 1. 로컬 이름 변경
git branch -m feature/login feature/auth

# 2. 새 이름으로 push (추적 관계 갱신)
git push -u origin feature/auth

# 3. 원격의 구 이름 삭제
git push origin --delete feature/login
```

팀원들은 로컬 추적 브랜치가 남아 있으므로 `git fetch --prune`을 실행해야 한다.

![원격 브랜치 이름 변경 흐름](/assets/posts/git-branch-rename-delete-remote.svg)

## 브랜치 삭제

```bash
# 안전 삭제: 현재 브랜치에 병합됐을 때만 삭제
git branch -d feature-login

# 강제 삭제: 병합 여부 무관
git branch -D feature-login
```

`-d`는 병합되지 않은 커밋이 있으면 다음처럼 오류를 낸다.

```
error: The branch 'feature-login' is not fully merged.
If you are sure you want to delete it, run 'git branch -D feature-login'.
```

이 메시지는 안전망이다. 의도적으로 폐기하는 경우에만 `-D`를 쓴다.

## 원격 브랜치 삭제

```bash
# 전체 형식
git push origin --delete feature-login

# 단축 형식 (콜론 + 브랜치명)
git push origin :feature-login
```

두 명령은 동일하다. 원격 저장소에서 브랜치 참조가 제거될 뿐, 이미 병합된 커밋은 그대로 남는다.

## 실수로 -D 삭제 후 복구

강제 삭제한 직후에는 `git reflog`로 커밋 SHA-1을 찾아 복구할 수 있다.

```bash
# reflog에서 삭제 직전 커밋 해시 확인
git reflog
# → abc1234 HEAD@{2}: checkout: moving from feature-login to main

# 그 해시로 브랜치 복구
git branch feature-login abc1234
```

reflog 보존 기간(기본 90일) 이내라면 복구가 가능하다.

## 현재 브랜치는 삭제 불가

체크아웃된 브랜치는 삭제할 수 없다.

```bash
git switch main
git branch -d feature-login  # 이제 삭제 가능
```

---

**지난 글:** [git branch: 브랜치 목록 조회와 생성](/posts/git-branch-list-create/)

**다음 글:** [추적 브랜치(Tracking Branch): 로컬과 원격의 연결 고리](/posts/git-branch-tracking/)

<br>
읽어주셔서 감사합니다. 😊
