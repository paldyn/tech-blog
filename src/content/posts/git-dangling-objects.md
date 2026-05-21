---
title: "Git dangling objects 이해와 처리"
description: "dangling commit/blob/tree의 발생 원인과 생명주기, git fsck/cat-file로 내용 확인하고 복구 또는 정리하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "dangling", "fsck", "복구", "저장소 관리"]
featured: false
draft: false
---

[지난 글](/posts/git-gc/)에서 `git gc`로 저장소를 최적화했다. gc를 실행하면 "dangling commit", "dangling blob" 같은 메시지가 나오는 경우가 있다. 이번에는 dangling object가 무엇인지, 어떻게 생기고 어떻게 처리하는지 자세히 알아본다.

## dangling object란

Git의 모든 객체(commit, tree, blob, tag)는 서로를 SHA-1 해시로 참조한다. HEAD → 브랜치 → 커밋 → 트리 → blob으로 이어지는 참조 체인에서 어디에서도 참조되지 않는 객체를 **dangling object** 또는 **unreachable object**라고 한다.

dangling object는 저장소가 손상된 것이 아니다. 정상적인 Git 작업의 부산물이다.

![dangling objects 종류와 발생 원인](/assets/posts/git-dangling-objects-types.svg)

## 발생 시나리오

### 브랜치 삭제 → dangling commit

```bash
git checkout -b feature/auth
git commit -m "feat: 인증 추가"
git commit -m "feat: 토큰 갱신"

# 브랜치를 머지하지 않고 삭제
git checkout main
git branch -D feature/auth
# 이 브랜치의 두 커밋이 dangling commit이 됨
```

### git reset → dangling commit

```bash
git reset --hard HEAD~3
# 제거된 3개 커밋이 dangling commit이 됨
# reflog에는 30일간 남아 있음
```

### git add 후 reset → dangling blob

```bash
echo "secret content" > file.txt
git add file.txt          # blob 객체 생성
git reset HEAD file.txt   # staging 취소
# file.txt blob이 dangling blob이 됨
```

### git amend/rebase → dangling commit + tree

```bash
git commit -m "원본 메시지"
git commit --amend -m "수정된 메시지"
# 원본 커밋 객체가 dangling commit이 됨
# 원본 tree 객체도 dangling tree가 될 수 있음
```

## dangling objects 확인

```bash
# 모든 unreachable 객체 출력
git fsck --unreachable 2>/dev/null

# 출력 예시
# unreachable commit abc1234abc1234...
# unreachable tree def5678def5678...
# unreachable blob ghi9012ghi9012...

# dangling만 (unreachable + 다른 객체에서도 참조 안 됨)
git fsck --dangling 2>/dev/null

# 종류별 카운트
git fsck --unreachable 2>/dev/null | \
  awk '{print $2}' | sort | uniq -c
```

## 내용 확인: cat-file

dangling 상태라도 SHA를 알면 내용을 볼 수 있다.

```bash
# 객체 타입 확인
git cat-file -t abc1234
# commit

# 커밋 내용 확인
git cat-file -p abc1234
# tree def5678...
# parent 111222...
# author Kim Dev <kim@example.com> ...
# committer Kim Dev <kim@example.com> ...
# feat: 중요한 기능 추가

# blob 내용 확인 (파일 내용)
git cat-file -p ghi9012
# (파일 내용 출력)

# 커밋 단축 로그
git show --oneline --no-patch abc1234
```

## 복구와 정리

![dangling objects 복구 vs 정리](/assets/posts/git-dangling-objects-recover.svg)

### 복구: 브랜치나 파일로 살리기

```bash
# dangling commit → 브랜치로 복구
git checkout -b recovered/feature abc1234

# dangling commit → 현재 브랜치에 cherry-pick
git cherry-pick abc1234

# dangling blob → 파일로 추출
git cat-file -p ghi9012 > recovered-file.txt
git show ghi9012        # 내용 확인 후 저장
```

### git fsck --lost-found 활용

```bash
# dangling 객체를 .git/lost-found/ 에 저장
git fsck --lost-found

# 디렉터리 구조
# .git/lost-found/
#   commit/   ← 각 파일명이 dangling commit의 SHA
#   other/    ← blob, tree

# commit 디렉터리 조회
ls .git/lost-found/commit/ | while read sha; do
  echo "=== $sha ==="
  git show --oneline --no-patch "$sha" 2>/dev/null
done
```

### 정리: 즉시 삭제

복구가 필요 없는 dangling 객체를 즉시 정리한다.

```bash
# reflog 만료 후 gc prune
git reflog expire --expire=now --all
git gc --prune=now

# 정리 확인
git fsck 2>/dev/null | grep dangling
# (출력 없으면 깨끗한 상태)
```

## 안전한 기본값: 자동 만료 기간

평소에는 기본 설정을 그대로 두는 것이 안전하다.

- reflog 만료: **90일** (`gc.reflogExpire`)
- unreachable 객체 만료: **30일** (`gc.reflogExpireUnreachable`)

실수로 브랜치나 커밋을 삭제했을 때 이 기간 안에 복구할 수 있다. `--prune=now`는 이 보호망을 없애는 명령이므로 신중하게 사용해야 한다.

다음 글에서는 실제로 삭제된 브랜치를 단계별로 복구하는 전체 과정을 살펴본다.

---

**지난 글:** [git gc로 저장소 최적화하기](/posts/git-gc/)

**다음 글:** [삭제된 브랜치 복구하기](/posts/git-recover-deleted-branch/)

<br>
읽어주셔서 감사합니다. 😊
