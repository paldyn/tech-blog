---
title: "Git Shallow Clone vs Full Clone: 언제 무엇을 쓸까"
description: "git clone --depth 옵션으로 히스토리 일부만 가져오는 shallow clone과 전체 히스토리를 받는 full clone의 차이, 사용 사례별 권장 전략을 비교한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "shallow-clone", "depth", "CI", "성능", "클론"]
featured: false
draft: false
---

[지난 글](/posts/git-partial-clone/)에서 partial clone으로 오브젝트 타입을 선별해 다운로드하는 방법을 살펴봤다. 이번에는 히스토리 깊이를 제한하는 **shallow clone**과 전체 히스토리를 가져오는 **full clone**을 비교한다.

## Shallow Clone이란

`git clone --depth=N`으로 최근 N개의 커밋만 가져오는 방식이다. 수년간의 히스토리가 쌓인 저장소에서 `--depth=1`을 쓰면 최신 커밋 하나만 내려받아 클론 시간과 디스크 사용량을 대폭 줄일 수 있다.

```bash
# 최신 커밋 1개만 (가장 빠름)
git clone --depth=1 https://github.com/org/repo.git

# 최근 10개 커밋
git clone --depth=10 https://github.com/org/repo.git
```

## 두 방식의 차이

![Shallow Clone vs Full Clone 비교](/assets/posts/git-shallow-vs-deep-comparison.svg)

Shallow clone에는 **shallow boundary**가 존재한다. 이 경계 이전의 커밋은 로컬에 없어 히스토리 탐색이 제한된다.

| 기능 | Full Clone | Shallow Clone |
|---|---|---|
| 클론 속도 | 느림 | 빠름 |
| 디스크 사용 | 많음 | 적음 |
| `git log --all` | 전체 히스토리 | 제한됨 |
| `git bisect` | 완전 동작 | boundary 제한 |
| `git blame` | 완전 동작 | 오래된 라인 제한 |
| `git rebase` | 자유로움 | boundary 이전 제한 |
| 오프라인 작업 | 완전 가능 | 제한적 |

## Shallow Clone의 다양한 옵션

![Shallow Clone 옵션과 활용 패턴](/assets/posts/git-shallow-vs-deep-options.svg)

### --single-branch

특정 브랜치의 히스토리만 가져온다. `--depth`와 함께 쓰면 효과가 배가된다.

```bash
# main 브랜치, 최근 1개 커밋만
git clone --depth=1 --single-branch -b main https://github.com/org/repo.git
```

`--single-branch`를 쓰면 다른 원격 브랜치를 `git fetch`로 가져올 수 없다. 나중에 다른 브랜치가 필요하면 `git remote set-branches --add origin feature/*` 후 fetch한다.

### --shallow-since

특정 날짜 이후의 커밋만 가져온다.

```bash
# 최근 1년 내 커밋만 클론
git clone --shallow-since="1 year ago" https://github.com/org/repo.git

# 특정 날짜 이후
git clone --shallow-since=2025-01-01 https://github.com/org/repo.git
```

### --shallow-exclude

특정 태그나 브랜치 이전 커밋을 제외한다.

```bash
# v1.0 태그 이전 히스토리 제외
git clone --shallow-exclude=v1.0 https://github.com/org/repo.git
```

## Full Shallow로 전환

Shallow clone으로 시작했지만 이후 전체 히스토리가 필요해지면 unshallow 명령으로 전환할 수 있다.

```bash
# 전체 히스토리 다운로드 (shallow → full)
git fetch --unshallow

# 또는
git pull --unshallow
```

특정 커밋까지만 깊이를 늘리고 싶다면:

```bash
# 깊이를 50개 커밋으로 늘리기
git fetch --depth=50
```

## CI/CD에서의 Shallow Clone

CI 파이프라인에서 코드를 빌드하거나 테스트할 때 전체 히스토리는 필요 없다. `--depth=1`로 최신 코드만 받는 것이 표준이다.

```yaml
# GitHub Actions
- uses: actions/checkout@v4
  with:
    fetch-depth: 1   # --depth=1

# GitLab CI
variables:
  GIT_DEPTH: 1
```

다만 일부 CI 작업에서는 히스토리가 필요할 수 있다.

```yaml
# 태그 기반 버전 계산이 필요한 경우
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # 전체 히스토리 (0 = unshallow)

# 변경된 파일 비교 (PR base 커밋 필요)
- uses: actions/checkout@v4
  with:
    fetch-depth: 2   # 비교에 필요한 최소 깊이
```

## Shallow vs Partial Clone: 언제 무엇을?

| 목적 | 추천 방식 |
|---|---|
| CI 빌드 (히스토리 불필요) | `--depth=1 --single-branch` |
| 개발 환경 (파일은 필요, 큰 바이너리 제외) | `--filter=blob:none` |
| 모노레포 (일부 디렉터리만) | `--filter=blob:none --sparse` |
| 완전한 오프라인 개발 | 필터 없는 full clone |
| 과거 특정 기간 분석 | `--shallow-since=<date>` |

Shallow clone과 partial clone은 서로 배타적이지 않다. 함께 사용할 수 있다.

```bash
# 가장 공격적인 조합: blobless + shallow + single-branch
git clone --filter=blob:none --depth=1 --single-branch \
    -b main https://github.com/org/repo.git
```

이 조합은 최신 커밋 하나의 디렉터리 구조만 내려받고, 실제 파일은 접근할 때 가져온다. CI에서 클론 시간을 수십 초에서 수 초로 단축하는 데 효과적이다.

---

**지난 글:** [Git Partial Clone](/posts/git-partial-clone/)

<br>
읽어주셔서 감사합니다. 😊
