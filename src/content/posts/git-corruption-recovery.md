---
title: "Git 저장소 손상 복구하기"
description: "sha1 mismatch, missing blob, 빈 객체 파일 등 실제 저장소 손상 유형별 증상과 단계별 복구 방법. 원격 fetch, 인덱스 재생성, 재클론 전략을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "저장소 손상", "복구", "fsck", "corruption"]
featured: false
draft: false
---

[지난 글](/posts/git-recover-orphan-commit/)에서 고아 커밋을 복구했다. 이번에는 더 심각한 상황인 **저장소 손상(corruption)**을 다룬다. 디스크 오류, 비정상 종료, 네트워크 전송 오류로 인해 Git 객체 파일 자체가 손상되는 경우다. `git fsck`가 `error: sha1 mismatch`나 `missing blob` 같은 메시지를 출력한다면 여기서 시작한다.

## 손상 유형 파악

저장소 손상에는 여러 종류가 있다. 증상에 따라 복구 방법이 달라진다.

![Git 저장소 손상 유형과 증상](/assets/posts/git-corruption-recovery-types.svg)

## 1단계: 정확한 진단

```bash
# 전체 무결성 검사 (상세 오류만 출력)
git fsck --full 2>&1 | grep -v "^Checking\|^dangling"

# 오류 예시
# error: sha1 mismatch 91a3c8... (손상된 객체)
# error: object file .git/objects/91/a3c8... is empty
# missing blob 91a3c8...

# 기본 명령 동작 확인
git log --oneline -5 2>&1
git status 2>&1
```

오류 메시지에서 손상된 객체 SHA를 메모한다. 어떤 파일인지 역추적하는 데 필요하다.

## 2단계: 손상된 객체 파악

```bash
# 손상된 SHA가 어떤 타입인지 확인
git cat-file -t 91a3c8  2>&1
# fatal: loose object 91a3c8 (stored in .git/objects/...) is corrupt

# 어떤 트리/커밋에서 참조되는지 역추적
git log --all --full-history --find-object=91a3c8

# 손상된 blob이 어떤 파일인지 확인 (비어 있거나 손상된 경우)
find .git/objects -name "*.pack" -o -empty | head -20
```

## 3단계: 원격 저장소로 복구 (가장 일반적)

원격 저장소(GitHub, GitLab 등)가 있다면 거기서 누락된 객체를 가져온다.

![저장소 손상 복구 단계](/assets/posts/git-corruption-recovery-steps.svg)

```bash
# 원격에서 모든 객체 fetch
git fetch --all --tags

# fetch 후 다시 fsck
git fsck --full 2>&1 | grep -v "^Checking\|^dangling"

# 손상된 loose object 파일 직접 삭제 후 fetch로 재취득
rm .git/objects/91/a3c8<나머지40자리>
git fetch origin
git fsck  # 다시 확인
```

손상된 객체 파일을 삭제하면 `missing object` 상태가 된다. fetch 후 원격에서 해당 객체를 다시 내려받으면 복구된다.

## 4단계: 인덱스 손상 복구

`.git/index` 파일(staging area)이 손상된 경우 재생성한다.

```bash
# 인덱스 손상 증상
git status
# error: index file corrupt

# 해결: 인덱스 삭제 후 재생성
rm .git/index
git read-tree HEAD
# 또는
git checkout HEAD -- .

# 재확인
git status
```

인덱스를 삭제해도 커밋 이력은 영향 없다. 마지막 커밋(HEAD)에서 인덱스를 재생성하면 된다.

## 5단계: HEAD/refs 손상 복구

```bash
# HEAD 파일 확인
cat .git/HEAD
# (비어 있거나 이상한 내용)

# HEAD 수동 복구
echo "ref: refs/heads/main" > .git/HEAD
# 또는 직접 SHA 지정
echo "abc1234abc1234abc1234abc1234abc1234abc1234" > .git/HEAD

# refs 디렉터리 확인
ls .git/refs/heads/
cat .git/refs/heads/main  # 올바른 SHA인지 확인

# packed-refs에서 복구
cat .git/packed-refs | grep "refs/heads/main"
# abc1234... refs/heads/main
echo "abc1234..." > .git/refs/heads/main
```

## 6단계: 개별 파일 내용 복구

특정 파일의 이전 버전을 원격이나 백업에서 가져올 수 있다.

```bash
# 특정 파일의 최근 커밋 이력 (손상된 커밋 전까지)
git log --all --oneline -- src/payment.js

# 특정 커밋의 파일 체크아웃
git checkout abc1234 -- src/payment.js

# 원격 브랜치의 파일 직접 사용
git checkout origin/main -- src/payment.js
```

## 최후 수단: 재클론

로컬 복구가 불가능하다면 재클론이 가장 확실하다.

```bash
# 언커밋 변경사항 백업
git diff HEAD > uncommitted-changes.patch

# 재클론
cd ..
git clone https://github.com/user/repo.git repo-fresh
cd repo-fresh

# 백업한 패치 적용
git apply ../uncommitted-changes.patch
```

재클론 전에 uncommit 변경사항과 로컬에만 있는 브랜치를 반드시 백업한다.

## 예방 습관

```bash
# 정기적인 무결성 점검
git fsck 2>&1 | grep -v "^Checking\|^dangling"

# 원격에 자주 push (백업)
git push origin --all
git push origin --tags

# 로컬 백업 (bare clone)
git clone --bare . ../backup-repo.git
```

저장소 손상의 근본 원인이 디스크라면 Git 복구 후에도 같은 문제가 반복된다. OS 레벨의 디스크 검사(`fsck`, `chkdsk`)도 함께 실행해야 한다. 다음 글에서는 `git lost-found` 명령으로 완전히 고립된 객체를 찾는 방법을 마지막으로 살펴본다.

---

**지난 글:** [고아 커밋 복구하기](/posts/git-recover-orphan-commit/)

**다음 글:** [git lost-found로 고립 객체 찾기](/posts/git-lost-found/)

<br>
읽어주셔서 감사합니다. 😊
