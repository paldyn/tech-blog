---
title: "git describe — 버전 자동 생성"
description: "git describe 출력 구조, --tags·--always·--dirty 옵션, 빌드 시스템 통합, Annotated 태그와의 관계를 상세히 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "describe", "버전", "tag", "빌드", "CI/CD"]
featured: false
draft: false
---

[지난 글](/posts/git-tag-delete/)에서 태그 삭제 방법을 살펴봤다. 이번에는 태그를 기반으로 **현재 커밋의 버전 정보를 자동 생성**하는 `git describe`를 다룬다. 빌드 파이프라인에서 수동으로 버전 문자열을 관리하지 않고 Git 히스토리에서 직접 버전을 추출할 수 있다.

## git describe 기본 출력

`git describe`는 현재 HEAD에서 가장 가까운 Annotated 태그를 찾아 위치를 기술한다.

```bash
git describe
# v1.2.0-14-gabc1234
```

출력은 세 부분으로 구성된다.

- `v1.2.0`: 가장 가까운 Annotated 태그 이름
- `14`: 그 태그 이후의 커밋 개수
- `gabc1234`: `g`(git) + 현재 커밋 SHA 앞 7자리

정확히 태그가 붙은 커밋에서 실행하면 태그 이름만 출력된다.

```bash
git describe
# v1.2.0
```

![git describe 출력 해부](/assets/posts/git-describe-anatomy.svg)

## Annotated 태그만 참조하는 이유

기본 동작에서 `git describe`는 **Annotated 태그만** 참조한다. Lightweight 태그가 있어도 무시한다. Annotated 태그는 별도 태그 객체를 가지고 있어 tagger, 날짜, 메시지 등 릴리스 메타데이터가 풍부하기 때문이다.

```bash
# Lightweight 태그가 있어도 에러
git describe
# fatal: No names found, cannot describe anything.

# --tags로 Lightweight 포함
git describe --tags
# v1.0-beta-5-gabc1234
```

릴리스 버전을 `git describe`로 관리한다면 릴리스 태그를 항상 Annotated로 만들어야 한다.

## 핵심 옵션

```bash
# 태그 없어도 SHA로 출력 (에러 방지)
git describe --always
# abc1234

# Lightweight 태그 포함
git describe --tags

# 미커밋 변경 있으면 -dirty 접미사
git describe --dirty
# v1.2.0-14-gabc1234-dirty

# SHA 자리수 조정
git describe --abbrev=10
# v1.2.0-14-gabc1234abcd

# 조합
git describe --tags --always --dirty
```

![git describe 실전 활용](/assets/posts/git-describe-usecase.svg)

## 빌드 시스템 통합

`git describe` 출력을 빌드 파이프라인 버전 식별자로 사용하는 패턴이 광범위하게 쓰인다.

```bash
# Shell 변수로 사용
VERSION=$(git describe --tags --always)
echo "Building $VERSION"

# Makefile
VERSION := $(shell git describe --tags --always --dirty)

# Python setup.py
import subprocess
version = subprocess.check_output(
    ["git", "describe", "--tags", "--always"]
).decode().strip()
```

이 방식을 쓰면 릴리스 태그가 없는 개발 빌드에서도 `v1.2.0-5-gabc1234` 형태로 유니크한 버전 식별자를 자동으로 얻는다.

## 특정 커밋의 describe

HEAD가 아닌 다른 커밋의 describe도 확인할 수 있다.

```bash
# 특정 커밋의 위치 확인
git describe abc1234

# 브랜치 이름으로
git describe feature/login

# 태그가 붙은 커밋인지 확인
git describe --exact-match v1.0.0
# v1.0.0 (정확히 태그가 붙은 커밋이면 출력)
# fatal: ... (태그가 없으면 에러)
```

`--exact-match`는 CI에서 "이 커밋이 정확히 릴리스 태그인가?"를 확인하는 데 유용하다.

## CI에서 버전 자동화 예시

```yaml
# GitHub Actions
- name: Get version
  run: echo "VERSION=$(git describe --tags --always)" >> $GITHUB_ENV

- name: Build
  run: |
    docker build -t myapp:${{ env.VERSION }} .
    docker push myapp:${{ env.VERSION }}
```

릴리스 태그가 붙은 커밋에서는 `v1.2.0`이 이미지 태그가 되고, 개발 빌드에서는 `v1.2.0-14-gabc1234`가 된다. 수동 버전 관리 없이 Git 히스토리가 자동으로 버전 체계를 관리한다.

---

**지난 글:** [태그 삭제 — 로컬과 원격](/posts/git-tag-delete/)

**다음 글:** [릴리스 워크플로 — 태그 기반 배포 자동화](/posts/git-release-workflow/)

<br>
읽어주셔서 감사합니다. 😊
