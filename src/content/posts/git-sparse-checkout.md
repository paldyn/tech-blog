---
title: "Git Sparse Checkout: 필요한 디렉터리만 체크아웃"
description: "모노레포처럼 큰 저장소에서 일부 디렉터리만 로컬에 체크아웃하는 git sparse-checkout 사용법과 cone 모드, non-cone 모드의 차이를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "sparse-checkout", "모노레포", "대용량저장소", "성능"]
featured: false
draft: false
---

[지난 글](/posts/git-worktree-multi-branch/)에서 멀티 브랜치 병렬 개발 워크플로를 다뤘다. 이번에는 대용량 저장소에서 필요한 디렉터리만 선택적으로 체크아웃하는 **Sparse Checkout** 을 살펴본다.

## Sparse Checkout이 필요한 상황

수천 개의 패키지가 있는 모노레포를 클론하면 로컬에 수만 개의 파일이 생긴다. 그 중 실제로 작업하는 것은 한두 개의 패키지뿐이다. 나머지 파일들은 IDE의 인덱싱, 파일 감시, 검색 성능을 저하시킨다.

Sparse Checkout은 이 문제를 해결한다. Git 오브젝트 DB는 전체를 유지하지만, **작업 디렉터리에는 지정한 경로의 파일만 체크아웃**한다.

![Sparse Checkout: 필요한 디렉터리만 체크아웃](/assets/posts/git-sparse-checkout-concept.svg)

## 기본 사용법 (Cone 모드)

Git 2.25부터 도입된 **cone 모드**가 기본값이다. 디렉터리 단위로 패턴을 처리해 성능이 우수하다.

```bash
# 1. sparse-checkout 초기화
git sparse-checkout init

# 2. 포함할 디렉터리 지정
git sparse-checkout set apps/backend packages/shared

# 3. 현재 설정 확인
git sparse-checkout list
# apps/backend
# packages/shared
```

`git sparse-checkout set` 이후 작업 디렉터리를 보면 지정한 경로만 존재한다. 루트에 있는 `package.json`, `README.md` 같은 파일들은 항상 포함된다.

## 디렉터리 추가/변경

```bash
# 현재 설정에 새 디렉터리 추가
git sparse-checkout add tools/scripts

# 설정을 완전히 교체 (이전 설정 제거)
git sparse-checkout set packages/ui packages/shared
```

## Cone 모드와 Non-cone 모드

![Cone 모드 vs Non-cone 모드](/assets/posts/git-sparse-checkout-cone.svg)

**Cone 모드** (권장):
- 디렉터리 단위 지정
- 내부적으로 최적화된 패턴 매칭
- 대용량 저장소에서도 빠름

**Non-cone 모드**:
- `.git/info/sparse-checkout` 파일에 직접 글로브 패턴 작성
- `!pattern`으로 특정 경로 제외 가능
- 파일 단위 세밀한 제어 가능하지만 성능이 낮음

```bash
# non-cone 모드로 초기화 (특수 케이스)
git sparse-checkout init --no-cone

# .git/info/sparse-checkout 직접 편집
cat > .git/info/sparse-checkout << 'EOF'
/*
!/docs/
!/tools/
apps/backend/**
EOF
```

대부분의 실무 사례에서는 cone 모드로 충분하다.

## 전체 체크아웃으로 되돌리기

```bash
# sparse-checkout 비활성화 (모든 파일 체크아웃)
git sparse-checkout disable
```

## partial clone과 함께 사용

Sparse Checkout만으로는 Git 오브젝트 DB 자체의 크기는 줄지 않는다. 다운로드 용량까지 줄이려면 **partial clone** 과 함께 사용한다.

```bash
# partial clone으로 클론 후 sparse-checkout 적용
git clone --filter=blob:none --sparse https://github.com/org/monorepo.git
cd monorepo
git sparse-checkout set apps/backend
```

`--filter=blob:none`(blobless clone)은 블롭(파일 내용) 오브젝트를 즉시 다운로드하지 않고 필요할 때 가져온다. sparse-checkout과 함께 사용하면 지정한 경로의 파일만 실제로 다운로드된다.

## 실용적인 팁

CI/CD 파이프라인에서 특정 서비스만 빌드할 때 sparse-checkout으로 클론 시간을 단축할 수 있다.

```bash
#!/bin/bash
# CI 스크립트: backend 서비스만 빌드
git clone --filter=blob:none --sparse https://github.com/org/monorepo.git
cd monorepo
git sparse-checkout set apps/backend packages/shared

# 이제 backend 관련 파일만 존재
cd apps/backend && npm ci && npm run build
```

---

**지난 글:** [Git Worktree 멀티 브랜치 워크플로](/posts/git-worktree-multi-branch/)

**다음 글:** [Git Partial Clone](/posts/git-partial-clone/)

<br>
읽어주셔서 감사합니다. 😊
