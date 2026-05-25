---
title: "git rev-parse: 참조를 SHA로 변환하는 범용 도구"
description: "git rev-parse로 HEAD·브랜치·태그·조상 표현식을 완전한 SHA로 변환하는 방법, --show-toplevel·--abbrev-ref·--short 등 저장소 정보 조회 옵션, 스크립트 활용 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "rev-parse", "plumbing", "SHA", "refs", "스크립트", "내부구조"]
featured: false
draft: false
---

[지난 글](/posts/git-hash-object/)에서 파일로 blob 오브젝트를 만드는 방법을 살펴봤다. 이번에는 Git 스크립트 작성의 핵심 도구인 `git rev-parse`를 다룬다. 이 명령은 단순해 보이지만 Git의 다양한 참조 표현식을 SHA로 변환하거나 저장소 정보를 추출하는 강력한 plumbing 명령이다.

## git rev-parse의 역할

`git rev-parse`는 두 가지 주요 기능을 한다.

**참조 해석**: 브랜치명, 태그명, HEAD, 조상 표현식(`~`, `^`) 등을 완전한 40자 SHA로 변환한다.

**저장소 정보 조회**: `--show-toplevel`, `--git-dir`, `--abbrev-ref` 등의 옵션으로 저장소 메타데이터를 추출한다.

```bash
# 기본 사용: 참조 → SHA
git rev-parse HEAD
# abc123def456789abcdef...

git rev-parse main
# abc123def456789abcdef...

git rev-parse v1.0.0
# tag SHA 또는 커밋 SHA
```

## 참조 표현식 해석

![참조 표현식 → SHA 변환](/assets/posts/git-rev-parse-refs.svg)

```bash
# 조상 탐색
git rev-parse HEAD~3      # 3번째 이전 커밋
git rev-parse HEAD^       # 첫 번째 부모 (= HEAD~1)
git rev-parse HEAD^2      # 두 번째 부모 (merge 커밋)

# 타입 역참조
git rev-parse HEAD^{tree}    # HEAD 커밋의 tree SHA
git rev-parse HEAD^{commit}  # 태그가 가리키는 commit SHA
git rev-parse v1.0.0^{}      # 태그 대상 오브젝트 SHA

# reflog 기반
git rev-parse HEAD@{1}    # reflog 한 단계 전
git rev-parse HEAD@{yesterday}
git rev-parse main@{2.weeks.ago}
```

## 저장소 정보 조회

![유틸리티 옵션](/assets/posts/git-rev-parse-options.svg)

```bash
# 저장소 루트 찾기 (서브디렉터리에서도 동작)
git rev-parse --show-toplevel
# /home/alice/myproject

# .git 경로 (worktree에서는 다를 수 있음)
git rev-parse --git-dir
# /home/alice/myproject/.git

# 현재 브랜치명
git rev-parse --abbrev-ref HEAD
# main   (detached HEAD면 HEAD 출력)

# 단축 SHA
git rev-parse --short HEAD        # 7자리 (기본)
git rev-parse --short=12 HEAD     # 12자리

# 저장소 내부인지 확인
git rev-parse --is-inside-work-tree  # true / false
git rev-parse --is-inside-git-dir    # true / false
```

## 스크립트에서 활용

`git rev-parse`는 셸 스크립트에서 Git 환경을 검증하고 값을 추출하는 데 빠질 수 없다.

```bash
#!/bin/bash

# git 저장소 확인
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "Error: not a git repository" >&2
  exit 1
fi

# 저장소 루트로 이동
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

# 현재 커밋 SHA 저장
CURRENT=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Branch: $BRANCH ($SHORT)"
```

## 범위 표현식

두 커밋 사이의 범위를 SHA로 나열하는 데 사용한다.

```bash
# A..B: A에 없는 B의 커밋들
git rev-parse main..feature    # feature가 앞서는 커밋 목록
git rev-list main..feature     # 실제 나열 (rev-parse는 범위 시작·끝 SHA)

# A...B: 공통 base를 제외한 양쪽 모두
git rev-parse main...feature

# 머지 base (공통 조상)
git merge-base main feature
```

## 여러 참조 동시 해석

```bash
# 여러 참조 한 번에
git rev-parse HEAD HEAD~1 HEAD~2
# abc123...
# def456...
# ghi789...

# 브랜치 목록의 SHA 추출
git branch --format="%(refname:short)" | \
  xargs git rev-parse 2>/dev/null

# 현재 브랜치가 main을 포함하는지 확인
MAIN_SHA=$(git rev-parse main)
CURRENT_SHA=$(git rev-parse HEAD)
if git merge-base --is-ancestor "$MAIN_SHA" "$CURRENT_SHA"; then
  echo "current branch contains main"
fi
```

## 부분 SHA 해석

SHA 전체 40자를 입력하지 않아도 고유하게 특정할 수 있는 앞부분만 입력하면 `rev-parse`가 전체 SHA를 반환한다.

```bash
# 부분 SHA로 전체 SHA 조회
git rev-parse abc12
# abc123def456...  (고유한 경우)

# 고유하지 않으면 에러
git rev-parse abc1
# error: short SHA1 abc1 is ambiguous
```

## git rev-parse vs git show-ref

비슷해 보이는 두 명령의 차이가 있다.

```bash
# rev-parse: 표현식을 SHA로 해석 (다목적)
git rev-parse refs/heads/main

# show-ref: ref 데이터베이스를 직접 목록화
git show-ref --head
# abc123... HEAD
# abc123... refs/heads/main
# def456... refs/tags/v1.0
```

`show-ref`는 실제 존재하는 ref만 출력하고, `rev-parse`는 표현식을 계산해 SHA를 반환한다는 차이가 있다.

---

**지난 글:** [git hash-object: 파일을 직접 오브젝트로 만들기](/posts/git-hash-object/)

**다음 글:** [git update-ref: 참조를 직접 수정하는 plumbing 명령](/posts/git-update-ref/)

<br>
읽어주셔서 감사합니다. 😊
