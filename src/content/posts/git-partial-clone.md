---
title: "Git Partial Clone: 필요한 오브젝트만 다운로드"
description: "git clone --filter 옵션으로 blobless, treeless 클론하는 방법, lazy fetching 동작 원리, CI/CD에서 클론 시간을 단축하는 실용 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "partial-clone", "filter", "성능", "CI", "대용량저장소"]
featured: false
draft: false
---

[지난 글](/posts/git-sparse-checkout/)에서 필요한 디렉터리만 체크아웃하는 sparse checkout을 다뤘다. Sparse checkout이 *작업 디렉터리*를 줄인다면, **Partial Clone**은 *다운로드하는 Git 오브젝트* 자체를 줄인다.

## Partial Clone이란

일반적인 `git clone`은 저장소의 모든 커밋, 트리, 블롭(파일 내용) 오브젝트를 다운로드한다. 수년간 쌓인 바이너리 파일이 많은 저장소에서는 이 과정에 수십 분이 걸리기도 한다.

Partial Clone은 **--filter** 옵션으로 특정 오브젝트 타입을 즉시 다운로드하지 않고, 실제로 필요할 때 **lazily** 가져오도록 설정한다.

## 세 가지 필터 유형

![Partial Clone 3가지 필터 유형](/assets/posts/git-partial-clone-types.svg)

### Blobless Clone (가장 권장)

```bash
git clone --filter=blob:none https://github.com/org/repo.git
```

커밋과 트리 오브젝트는 즉시 다운로드하고, 블롭(파일 내용)은 체크아웃하거나 파일에 접근할 때 가져온다. `git log`, `git show HEAD`, `git branch` 같은 메타데이터 명령은 즉시 동작한다.

실제 파일이 필요한 명령(`git checkout`, `git diff` 등)을 실행할 때 해당 파일의 블롭을 자동으로 fetch한다.

### Treeless Clone

```bash
git clone --filter=tree:0 https://github.com/org/repo.git
```

커밋만 즉시 다운로드하고, 트리와 블롭은 필요할 때 가져온다. 초기 클론이 가장 빠르지만 히스토리 탐색 시 추가 네트워크 요청이 발생한다. CI 파이프라인처럼 커밋 SHA만 필요한 상황에 적합하다.

### 크기 제한 필터

```bash
# 1MB 이하 블롭만 즉시 다운로드
git clone --filter=blob:limit=1m https://github.com/org/repo.git
```

소스 코드(보통 작은 크기)는 즉시 받고, 대용량 바이너리만 lazy 처리한다. LFS 설정 없이 큰 파일을 건너뛰고 싶을 때 유용하다.

## 동작 원리

![Blobless Clone 동작 원리](/assets/posts/git-partial-clone-flow.svg)

Partial Clone은 서버와 클라이언트 모두 지원해야 동작한다. GitHub, GitLab, Gitea는 모두 지원한다. 지원하지 않는 서버에서는 `--filter` 옵션이 무시되고 전체 클론이 실행된다.

## CI/CD에서 활용

Partial Clone의 가장 강력한 활용처는 CI/CD 파이프라인이다.

```yaml
# GitHub Actions 예시
- name: Checkout (blobless)
  uses: actions/checkout@v4
  with:
    filter: blob:none

# 또는 직접 git 명령 사용
- name: Checkout
  run: |
    git clone --filter=blob:none --depth=1 \
      https://github.com/org/repo.git .
```

`--depth=1`(shallow clone)과 `--filter=blob:none`을 함께 사용하면 최신 커밋의 파일만 다운로드해 클론 시간을 대폭 단축한다.

## Sparse Checkout과 결합

Partial Clone과 Sparse Checkout을 함께 사용하면 다운로드 용량과 체크아웃 파일 수를 모두 최소화할 수 있다.

```bash
# 1. Partial clone + sparse 초기화
git clone --filter=blob:none --sparse https://github.com/org/monorepo.git
cd monorepo

# 2. 필요한 경로만 지정
git sparse-checkout set apps/backend packages/shared

# 결과: apps/backend 와 packages/shared 의 현재 파일만 다운로드됨
```

이 조합은 수만 개의 파일이 있는 모노레포에서 특히 효과적이다.

## 주의사항

**일부 Git 명령 성능 저하**: `git log --all -- path/to/file` 처럼 모든 히스토리의 특정 파일을 탐색하는 명령은 blob을 하나씩 lazy fetch하므로 느릴 수 있다.

**오프라인 작업**: 네트워크 없이 블롭에 접근하면 오류가 발생한다. 완전한 오프라인 작업이 필요하면 일반 clone을 사용하라.

**서버 호환성 확인**: 회사 내부 Git 서버가 partial clone을 지원하는지 확인 후 사용한다.

```bash
# partial clone 지원 여부 확인
git ls-remote --filter=blob:none <url>
# 오류 없이 응답하면 지원함
```

---

**지난 글:** [Git Sparse Checkout](/posts/git-sparse-checkout/)

**다음 글:** [Shallow Clone vs Deep Clone](/posts/git-shallow-vs-deep/)

<br>
읽어주셔서 감사합니다. 😊
