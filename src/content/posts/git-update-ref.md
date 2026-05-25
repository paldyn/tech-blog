---
title: "git update-ref: 참조를 직접 수정하는 plumbing 명령"
description: "git update-ref로 브랜치·태그 ref를 직접 생성·수정·삭제하는 방법, old SHA 검증으로 안전하게 업데이트하기, --stdin 트랜잭션 모드로 여러 ref를 원자적으로 처리하는 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "update-ref", "plumbing", "refs", "브랜치", "내부구조", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/git-rev-parse/)에서 참조를 SHA로 변환하는 `git rev-parse`를 살펴봤다. 이번에는 반대 방향 — 참조 자체를 만들거나 바꾸는 `git update-ref`를 다룬다.

## git update-ref란

브랜치, 태그, HEAD 같은 Git 참조는 `.git/refs/` 아래의 텍스트 파일이거나 `.git/packed-refs`에 기록된 항목이다. `git update-ref`는 이 파일들을 직접, 안전하게 수정하는 plumbing 명령이다.

```bash
# 기본 문법
git update-ref <ref> <new-sha>           # 무조건 덮어씀
git update-ref <ref> <new-sha> <old-sha> # old-sha 일치할 때만 수정

# HEAD 확인
cat .git/refs/heads/main
# abc123def456...
```

## ref 생성 (브랜치 만들기)

```bash
# 특정 SHA에 브랜치 생성
git update-ref refs/heads/new-feature abc123def456

# 이것은 다음과 동일
git branch new-feature abc123def456

# 태그 생성
git update-ref refs/tags/v1.0.0 abc123def456
```

`git branch` 명령도 내부적으로 `update-ref`를 호출한다. plumbing을 쓰면 포르셀린 명령이 거부하는 상황에서도 ref를 직접 조작할 수 있다.

## ref 업데이트 (브랜치 이동)

![update-ref 동작](/assets/posts/git-update-ref-diagram.svg)

```bash
# 현재 main이 어디를 가리키는지 확인
git rev-parse main

# main을 새 커밋으로 이동
git update-ref refs/heads/main def789abc012

# git reset --hard def789abc012 와 유사하나
# working tree는 건드리지 않는다는 차이 있음
```

## old SHA 검증으로 안전한 업데이트

![안전 체크](/assets/posts/git-update-ref-safety.svg)

`git update-ref`의 핵심 안전 기능은 세 번째 인자로 old SHA를 전달하는 것이다. 현재 ref가 old SHA와 다르면 업데이트를 거부한다. 경쟁 조건(race condition)을 방지하는 낙관적 잠금(optimistic locking) 패턴이다.

```bash
OLD=$(git rev-parse refs/heads/main)
# 처리 작업 수행...
# 이 사이에 다른 프로세스가 main을 바꿨다면 업데이트 실패
git update-ref refs/heads/main $NEW $OLD
# error: ref refs/heads/main is at ... but expected ...
```

Git의 server-side 훅이나 자동화 스크립트에서 동시 업데이트 충돌을 막을 때 유용하다.

## ref 삭제

```bash
# 브랜치 삭제 (-d)
git update-ref -d refs/heads/old-branch

# old SHA 검증 후 삭제
git update-ref -d refs/heads/old-branch $OLD_SHA

# git branch -D old-branch 와 동일 효과
```

`-d` 플래그를 사용하면 ref를 완전히 제거한다. packed-refs에 있는 ref도 정리된다.

## --stdin 트랜잭션 모드

여러 ref를 원자적으로 업데이트해야 할 때 `--stdin` 모드를 사용한다.

```bash
git update-ref --stdin <<'EOF'
start
update refs/heads/main $NEW_MAIN $OLD_MAIN
update refs/heads/release/1.0 $NEW_REL $OLD_REL
delete refs/tags/old-tag
commit
EOF
```

트랜잭션 명령어:
- `start`: 트랜잭션 시작 (잠금 획득)
- `update <ref> <new> [old]`: ref 업데이트
- `create <ref> <new>`: 새 ref 생성
- `delete <ref> [old]`: ref 삭제
- `verify <ref> [old]`: 현재값 검증만 (변경 없음)
- `commit`: 모든 변경 적용
- `abort`: 트랜잭션 취소, 잠금 해제

`commit` 전에 하나라도 실패하면 전체가 취소된다.

## HEAD 업데이트 주의사항

HEAD를 `update-ref`로 직접 바꾸면 symbolic ref 관계가 끊어질 수 있다.

```bash
# HEAD는 보통 symbolic ref
cat .git/HEAD
# ref: refs/heads/main

# update-ref로 HEAD 직접 변경 → detached HEAD가 됨
git update-ref HEAD abc123def456
cat .git/HEAD
# abc123def456...  (더 이상 symbolic ref가 아님)

# symbolic ref 업데이트는 symbolic-ref 사용
git symbolic-ref HEAD refs/heads/other-branch
```

## 실전: plumbing으로 커밋 후 브랜치 갱신

`git commit-tree`로 커밋을 만들고 `update-ref`로 브랜치를 갱신하는 조합은 자동화 스크립트의 핵심 패턴이다.

```bash
# 새 커밋 생성 (부모 포함)
TREE=$(git write-tree)
PARENT=$(git rev-parse HEAD)
COMMIT=$(git commit-tree $TREE -p $PARENT -m "automated commit")

# 브랜치를 새 커밋으로 업데이트
git update-ref refs/heads/main $COMMIT $PARENT

echo "Branch main → $COMMIT"
```

이 패턴으로 working tree를 전혀 건드리지 않고 커밋을 만들고 브랜치를 갱신할 수 있다. CI/CD 시스템에서 메타데이터 커밋을 자동 생성할 때 유용하다.

---

**지난 글:** [git rev-parse: 참조를 SHA로 변환하는 범용 도구](/posts/git-rev-parse/)

**다음 글:** [Git Plumbing vs Porcelain: 명령어 계층 이해하기](/posts/git-plumbing-vs-porcelain/)

<br>
읽어주셔서 감사합니다. 😊
