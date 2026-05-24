---
title: "Git Refs 내부 구조: .git/refs/ 디렉터리"
description: ".git/refs/ 아래 heads·tags·remotes 디렉터리의 역할, ref 파일이 SHA를 담는 방식, show-ref·for-each-ref·update-ref 명령으로 ref를 조회하고 조작하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "refs", "내부구조", "show-ref", "for-each-ref", "update-ref"]
featured: false
draft: false
---

[지난 글](/posts/git-sha1-vs-sha256/)에서 오브젝트를 식별하는 SHA 해시를 살펴봤다. SHA 해시는 강력하지만 기억하기 어렵다. **refs**는 SHA에 사람이 읽을 수 있는 이름을 붙이는 메커니즘이다.

## ref의 본질

ref는 **SHA 해시를 담은 텍스트 파일**이다. 브랜치 `main`은 `.git/refs/heads/main`이라는 파일이고, 그 안에는 최신 커밋 SHA 40자가 들어있다.

```bash
# 직접 확인
cat .git/refs/heads/main
# abc123def456789...

# git 명령으로 확인 (동일 결과)
git rev-parse refs/heads/main
# abc123def456789...
```

파일 하나 = SHA 하나 = 커밋 하나를 가리키는 포인터다.

![Refs 디렉터리 구조](/assets/posts/git-refs-internal-structure.svg)

## .git/refs/ 디렉터리 구조

```
.git/
├── HEAD                    ← 현재 체크아웃 위치 (symbolic ref)
├── packed-refs             ← 압축된 refs (git pack-refs 실행 후)
└── refs/
    ├── heads/              ← 로컬 브랜치
    │   ├── main
    │   └── feature/login   ← 슬래시가 디렉터리 구분자가 됨
    ├── tags/               ← 태그
    │   └── v1.0.0
    └── remotes/            ← 원격 추적 브랜치
        └── origin/
            ├── main
            └── HEAD        ← 원격 기본 브랜치
```

`feature/login` 브랜치는 `refs/heads/feature/login` 경로에 저장된다. 브랜치 이름의 `/`가 실제 파일시스템 디렉터리 구분자가 된다.

## refs/heads/, refs/tags/, refs/remotes/ 차이

| 경로 | 역할 |
|------|------|
| `refs/heads/{name}` | 로컬 브랜치 — `git branch`로 조작 |
| `refs/tags/{name}` | 태그 — lightweight는 commit SHA, annotated는 tag 오브젝트 SHA |
| `refs/remotes/{remote}/{name}` | 원격 추적 브랜치 — fetch 시 자동 갱신 |

```bash
# 로컬 브랜치 refs
ls .git/refs/heads/

# 태그 refs
ls .git/refs/tags/

# 원격 추적 refs
ls .git/refs/remotes/origin/
```

## ref 조회 명령

```bash
# 모든 ref 나열 (SHA + 전체 경로)
git show-ref

# 브랜치 ref만
git show-ref --heads

# 태그 ref만
git show-ref --tags

# 특정 ref 조회
git rev-parse refs/heads/main

# 상세 포맷 출력
git for-each-ref --format='%(refname:short) %(objectname:short) %(subject)' refs/heads/
```

![Refs 조작 명령](/assets/posts/git-refs-internal-commands.svg)

## ref 수동 조작: update-ref

`git update-ref`는 ref 파일을 안전하게 갱신하는 저수준 명령이다. 브랜치 이동이나 삭제 시 내부적으로 이 명령이 사용된다.

```bash
# 브랜치를 특정 SHA로 이동 (= git reset --hard의 ref 조작 부분)
git update-ref refs/heads/main <새SHA>

# ref 삭제 (= git branch -d와 동일)
git update-ref -d refs/heads/old-branch

# 새 브랜치 생성 (= git branch와 동일)
git update-ref refs/heads/new-feature $(git rev-parse HEAD)
```

`git branch`, `git tag`, `git reset` 등의 고수준 명령은 내부적으로 `update-ref`를 호출한다.

## ref 이름 분해 (refname 단축형)

Git은 ref 이름을 여러 형태로 지정할 수 있다. 우선순위에 따라 해석된다.

```bash
# 다음은 모두 같은 ref를 가리킬 수 있음
git rev-parse main
git rev-parse refs/heads/main
git rev-parse heads/main

# 태그
git rev-parse v1.0.0
git rev-parse refs/tags/v1.0.0

# 원격
git rev-parse origin/main
git rev-parse refs/remotes/origin/main
```

다음 글에서는 모든 ref의 최상위에 있는 특수 파일 **HEAD**의 본질을 살펴본다.

---

**지난 글:** [Git SHA-1 vs SHA-256: 해시 알고리즘 전환](/posts/git-sha1-vs-sha256/)

**다음 글:** [Git HEAD의 본질: symbolic ref와 detached HEAD](/posts/git-head-essence/)

<br>
읽어주셔서 감사합니다. 😊
