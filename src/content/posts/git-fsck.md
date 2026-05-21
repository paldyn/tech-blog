---
title: "git fsck로 저장소 무결성 검사하기"
description: "git fsck의 동작 원리와 dangling/missing/corrupted 객체 구분, 주요 옵션, 실전 진단 절차를 설명한다. 저장소 손상 여부를 확인하는 첫 번째 도구."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "fsck", "무결성 검사", "dangling", "저장소 복구"]
featured: false
draft: false
---

[지난 글](/posts/git-bisect-skip/)에서 bisect 탐색 중 불량 커밋을 건너뛰는 방법을 살펴봤다. 이번에는 저장소 자체의 건강 상태를 점검하는 도구인 `git fsck`를 알아본다. 저장소가 손상됐거나, 잃어버린 커밋을 찾거나, 불필요한 dangling 객체를 파악할 때 첫 번째로 꺼내는 명령이다.

## git fsck란

`fsck`는 "File System Check"의 약자로, Unix/Linux에서 파일시스템 무결성을 검사하는 도구다. `git fsck`는 Git 객체 데이터베이스를 검사해 두 가지를 확인한다.

1. **SHA-1 무결성**: 각 객체 파일의 내용이 그 파일명(SHA-1 해시)과 일치하는지 확인한다.
2. **참조 도달성**: 어떤 ref(HEAD, 브랜치, 태그)에서도 도달할 수 없는 고립된 객체(dangling object)를 찾는다.

![git fsck 저장소 구조와 개념](/assets/posts/git-fsck-overview.svg)

## 기본 실행

```bash
# 전체 무결성 검사
git fsck

# 출력 예시 (정상 저장소)
# Checking object directories: 100% (256/256), done.
# Checking connectivity: done.
# dangling commit abc1234abc1234abc1234abc1234abc1234abc1234
# dangling blob def5678def5678def5678def5678def5678def5678
```

dangling 메시지가 나와도 저장소가 "손상된" 것은 아니다. 단지 어떤 ref에서도 참조되지 않는 객체가 있다는 뜻이다. 브랜치 삭제, `git reset`, 스쿼시 머지 후 남은 커밋들이 dangling 상태가 된다.

## 주요 옵션

![git fsck 옵션과 출력 해석](/assets/posts/git-fsck-commands.svg)

```bash
# 도달 불가 객체만 출력 (dangling 포함)
git fsck --unreachable

# reflog를 참조 계산에서 제외
# (reflog에서만 참조되는 객체도 unreachable로 분류)
git fsck --no-reflogs --unreachable

# dangling commit의 메시지 확인
git fsck --unreachable | grep commit | \
  awk '{print $3}' | \
  xargs -I{} git show --oneline --no-patch {}
```

## 출력 메시지 해석

fsck 출력에서 각 메시지의 심각도가 다르다.

| 메시지 | 의미 | 심각도 |
|---|---|---|
| `dangling commit` | ref 없는 커밋 (복구 가능) | 정보 |
| `dangling blob` | ref 없는 파일 객체 | 정보 |
| `dangling tree` | ref 없는 디렉터리 객체 | 정보 |
| `missing blob` | 참조는 있는데 파일이 없음 | **심각** |
| `missing tree` | 참조는 있는데 tree가 없음 | **심각** |
| `error: sha1 mismatch` | 파일 내용과 해시 불일치 | **심각** |
| `broken link` | 부모-자식 객체 연결 끊김 | **심각** |

`dangling`으로 시작하는 메시지는 정보성이다. `missing`, `error`, `broken`이 나오면 저장소가 실제로 손상된 것이다.

## dangling commit 확인 및 복구

```bash
# dangling commit 목록
git fsck --unreachable 2>/dev/null | grep "unreachable commit"

# 각 커밋 메시지 확인
git show --oneline --no-patch abc1234

# 원하는 커밋 발견 시 브랜치 생성
git checkout -b recovered/feature abc1234

# 또는 현재 브랜치에 머지
git merge abc1234
```

## 저장소 손상 진단

`missing` 또는 `error`가 발생하면 먼저 원인을 파악한다.

```bash
# 상세 모드로 손상된 객체 파악
git fsck --full 2>&1 | grep -E "error:|missing|corrupt"

# 손상된 객체 SHA 확인
git cat-file -t abc1234   # 객체 타입 확인
git cat-file -p abc1234   # 객체 내용 확인

# 어떤 트리가 손상된 blob을 참조하는지 역추적
git log --all --full-history -- "*.ext" 2>&1 | head -20
```

## 원격 저장소로 복구

손상된 저장소에 원격 복사본이 있다면 원격에서 재클론하거나 누락된 객체만 가져온다.

```bash
# 원격에서 누락 객체 fetch
git fetch --all

# 원격과 비교하여 누락 여부 확인
git remote -v
git ls-remote origin

# 원격 저장소 fsck (bare clone으로)
git clone --bare https://github.com/user/repo.git repo-check.git
cd repo-check.git
git fsck --full
```

## 정기적인 fsck 권장 시점

- 예상치 못한 `git` 명령 오류 발생 시
- 디스크 오류 후
- 비정상 강제 종료(전원 차단 등) 후
- 대규모 git gc 실행 후
- 오래된 저장소의 정기 점검

```bash
# 건강 점검용 원라이너
git fsck 2>&1 | grep -v "^Checking\|^dangling" | head -20
# dangling 외에 다른 출력이 없으면 정상
```

다음 글에서는 `git gc`로 저장소를 최적화하고 불필요한 dangling 객체를 정리하는 방법을 살펴본다.

---

**지난 글:** [git bisect skip으로 불량 커밋 건너뛰기](/posts/git-bisect-skip/)

**다음 글:** [git gc로 저장소 최적화하기](/posts/git-gc/)

<br>
읽어주셔서 감사합니다. 😊
