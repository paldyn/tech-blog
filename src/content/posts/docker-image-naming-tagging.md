---
title: "Docker 이미지 네이밍과 태깅 전략"
description: "Docker 이미지 이름의 전체 구조(registry/namespace/repository:tag), 기본값 규칙, 시맨틱 버전·Git SHA·날짜 태그 전략 비교, 계층형 태그 관리, 팀 수준 네이밍 컨벤션 수립 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "naming", "tagging", "semver", "convention", "네이밍"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-platform-multi-arch/)에서 멀티 아키텍처 이미지를 빌드하는 방법을 살펴봤다. 이번에는 이미지를 어떻게 이름 짓고 버전을 관리할지, 팀에서 일관된 컨벤션을 어떻게 수립할지 다룬다. 이미지 이름 규칙은 단순해 보이지만, 배포 자동화와 이력 추적에 직결되는 중요한 결정이다.

## 이미지 이름의 완전한 구조

Docker 이미지의 완전한 이름은 네 부분으로 이루어진다.

```
ghcr.io / myorg / myapp : v2.1.0
   ↑         ↑       ↑       ↑
Registry  Namespace  Repo   Tag
```

각 구성 요소의 기본값이 있어 짧게 쓰면 자동으로 채워진다.

| 구성 요소 | 생략 시 기본값 |
|-----------|----------------|
| Registry  | `docker.io` (Docker Hub) |
| Namespace | `library` (공식 이미지) |
| Tag       | `latest` |

따라서 `nginx`는 사실 `docker.io/library/nginx:latest`와 같다.

![이미지 이름 구조](/assets/posts/docker-image-naming-anatomy.svg)

## 태그 전략 1: 시맨틱 버전 (SemVer)

가장 널리 사용되는 방식이다. MAJOR.MINOR.PATCH 버전을 이미지 태그에 그대로 적용하고, 여러 수준의 태그를 동시에 관리한다.

```bash
docker tag myapp:1.2.3 myrepo/myapp:1.2.3
docker tag myapp:1.2.3 myrepo/myapp:1.2
docker tag myapp:1.2.3 myrepo/myapp:1
docker tag myapp:1.2.3 myrepo/myapp:latest

docker push myrepo/myapp:1.2.3
docker push myrepo/myapp:1.2
docker push myrepo/myapp:1
docker push myrepo/myapp:latest
```

계층형 태그의 장점은 사용자가 얼마나 세밀하게 버전을 고정할지 선택할 수 있다는 것이다. `myapp:1`은 1.x.x 최신을 가리키고, `myapp:1.2.3`은 정확한 버전을 고정한다.

## 태그 전략 2: Git SHA

CI/CD에서 자동화하기 가장 좋은 방식이다. 모든 커밋이 유일한 이미지를 만들고, 코드와 이미지 버전이 일대일 대응된다.

```bash
# Git 커밋 SHA (앞 7자)
GIT_SHA=$(git rev-parse --short HEAD)
docker tag myapp:latest myrepo/myapp:${GIT_SHA}

# 브랜치 + SHA 조합
docker tag myapp:latest \
  myrepo/myapp:main-${GIT_SHA}
```

Git SHA 태그만으로는 어떤 버전인지 사람이 읽기 어렵다. SemVer 태그와 병행 사용하는 것이 좋다.

## 태그 전략 3: 날짜 기반

일정 주기(daily, weekly)로 릴리즈하는 서비스에 적합하다.

```bash
TODAY=$(date +%Y-%m-%d)
docker tag myapp:latest myrepo/myapp:${TODAY}
```

롤백 시 날짜로 이전 버전을 찾기 쉽다. 단, 같은 날 여러 번 빌드하면 덮어써진다.

## 태그 전략 4: 환경 태그

`prod`, `staging`, `dev` 같은 환경 이름을 태그로 사용하는 방법이다.

```bash
docker tag myapp:v1.2.3 myrepo/myapp:prod
docker tag myapp:v1.2.3 myrepo/myapp:staging
```

운영이 직관적이지만 가변 태그라 재현성 문제가 있다. Digest와 함께 사용하거나 보조 태그로만 사용하는 것이 좋다.

![태그 전략 비교](/assets/posts/docker-image-naming-strategy.svg)

## 이미지 이름 규칙 — 레지스트리별 제약

이미지 이름에는 소문자, 숫자, `-`, `_`, `.`만 사용할 수 있다.

```bash
# 유효한 이름
myrepo/my-app:v1.2.3
myrepo/my_app:2026-05-12

# 무효 (대문자 포함)
myrepo/MyApp:v1  # ✗

# 태그 길이 제한: 128자 이내
```

## 멀티 플랫폼 빌드에서의 태깅

멀티 아키텍처 이미지에서는 플랫폼 정보를 태그에 포함하는 경우도 있다.

```bash
# 단일 플랫폼 이미지에 플랫폼 명시
myrepo/myapp:v1.0-amd64
myrepo/myapp:v1.0-arm64

# Manifest List (플랫폼 중립)
myrepo/myapp:v1.0
```

docker buildx를 사용하면 별도 플랫폼 태그 없이 단일 태그로 멀티 아키텍처를 지원할 수 있다.

## 권장 컨벤션

팀마다 다르지만, 프로덕션 환경에서 검증된 패턴은 다음과 같다.

```bash
# 형식: registry/namespace/repo:semver+sha
ghcr.io/myorg/myapp:1.2.3        # 사람용 (고정)
ghcr.io/myorg/myapp:1.2          # 마이너 버전 (자동 갱신)
ghcr.io/myorg/myapp:1            # 메이저 버전 (자동 갱신)
ghcr.io/myorg/myapp:latest       # 최신 (자동 갱신)
ghcr.io/myorg/myapp:abc1234      # CI/CD용 Git SHA
```

`latest` 태그는 내부에서만 편의를 위해 사용하고, Digest를 Kubernetes나 Compose 설정에 고정하는 것이 배포 안정성을 높인다.

---

**지난 글:** [멀티 아키텍처 이미지와 docker buildx](/posts/docker-image-platform-multi-arch/)

**다음 글:** [베이스 이미지 선택 전략](/posts/docker-image-base-choice/)

<br>
읽어주셔서 감사합니다. 😊
