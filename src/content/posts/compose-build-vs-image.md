---
title: "Docker Compose build vs image: 언제 무엇을 쓰나"
description: "compose.yaml에서 build와 image의 차이, 함께 쓰는 패턴, build 고급 옵션(context, dockerfile, args, target, cache_from)을 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "build", "image", "멀티스테이지", "cache_from", "BuildKit"]
featured: false
draft: false
---

[지난 글](/posts/compose-services/)에서 `services` 키의 주요 옵션을 살펴봤다. 이번에는 서비스가 이미지를 가져오는 두 가지 방법 — `image`와 `build`의 차이와 활용법을 정리한다.

## image: 레지스트리에서 pull

```yaml
services:
  db:
    image: postgres:16         # Docker Hub

  cache:
    image: redis:7-alpine      # 태그 고정 권장

  metrics:
    image: prom/prometheus:v2.51.0  # 정확한 버전 고정
```

`image`는 지정한 이미지를 레지스트리(Docker Hub, ECR, GHCR 등)에서 pull해 컨테이너를 만든다. 이미지가 이미 로컬에 있으면 pull을 생략한다.

태그를 `latest`로 두면 팀원마다 다른 버전을 pull할 수 있다. 프로덕션에서는 반드시 정확한 버전 태그를 명시한다.

## build: 로컬 Dockerfile로 빌드

```yaml
services:
  api:
    build: ./api   # 단축형 (Dockerfile 자동 탐색)
```

`./api` 디렉터리의 `Dockerfile`을 찾아 이미지를 빌드한다. 코드와 함께 Compose 파일을 관리할 때 쓴다.

## 두 방법 비교

![build vs image 플로우](/assets/posts/compose-build-vs-image-diagram.svg)

| | `image` | `build` |
|--|---------|---------|
| 이미지 출처 | 레지스트리 | 로컬 빌드 |
| 코드 변경 반영 | push 필요 | `--build` 옵션 |
| 팀 협업 | 동일 이미지 | 빌드 결과 차이 가능 |
| 빌드 시간 | 없음 | 있음 (캐시 활용) |

## build + image 함께 쓰기

```yaml
services:
  api:
    build:
      context: ./api
    image: myregistry/api:${TAG:-latest}   # 빌드 결과에 이름 부여
```

빌드한 이미지에 이름을 부여해 `docker compose push`로 레지스트리에 올릴 수 있다. CI 파이프라인에서 빌드·태깅·푸시를 Compose로 처리할 때 유용하다.

## build 고급 옵션

![build 고급 옵션](/assets/posts/compose-build-vs-image-code.svg)

```yaml
services:
  api:
    build:
      context: ./api              # 빌드 컨텍스트
      dockerfile: Dockerfile.prod # Dockerfile 파일명 지정
      args:
        NODE_ENV: production      # ARG 값 전달
        BUILD_DATE: ${DATE}
      target: runtime             # 멀티스테이지 스테이지 지정
      cache_from:
        - myregistry/api:cache    # 레지스트리 캐시 재사용
      shm_size: 128m              # 빌드 시 /dev/shm 크기
```

### target: 멀티스테이지 빌드

개발 환경에서는 `deps` 스테이지만, 프로덕션에서는 `runtime` 스테이지를 빌드하도록 오버라이드 파일로 분리할 수 있다.

```yaml
# compose.yaml (공통)
services:
  api:
    build:
      context: ./api
      target: runtime

# compose.dev.yaml (개발 오버라이드)
services:
  api:
    build:
      target: development
    volumes:
      - ./api/src:/app/src
```

### cache_from: CI 레이어 캐시

CI 환경에서 매번 처음부터 빌드하지 않으려면 이전 빌드 이미지를 캐시 소스로 쓴다.

```bash
# CI 파이프라인 예시
docker compose build --pull    # 베이스 이미지도 최신으로 pull
docker compose push            # 캐시용으로 push
```

## 빌드 관련 명령

```bash
# 이미지 재빌드 후 컨테이너 시작
docker compose up --build -d

# 빌드만 실행 (컨테이너 시작 안 함)
docker compose build

# 특정 서비스만 빌드
docker compose build api

# 캐시 없이 완전히 새로 빌드
docker compose build --no-cache
```

## 개발 vs 프로덕션 패턴

개발 환경에서는 `build`로 코드 변경을 즉시 반영하고, 프로덕션에서는 CI가 빌드·푸시한 `image`를 참조한다.

```yaml
# compose.yaml (프로덕션: 레지스트리 이미지)
services:
  api:
    image: myregistry/api:${TAG}

# compose.override.yaml (개발: 로컬 빌드)
services:
  api:
    build: ./api
    volumes:
      - ./api/src:/app/src
```

`compose.override.yaml`은 자동 병합되므로 `docker compose up`만 실행하면 개발 설정이 적용된다.

## 정리

- `image`는 레지스트리에서 pull, `build`는 로컬 Dockerfile로 빌드한다.
- `build` + `image`를 함께 쓰면 빌드 결과에 이름을 부여해 `compose push`로 공유할 수 있다.
- `target`으로 멀티스테이지 스테이지를, `cache_from`으로 CI 레이어 캐시를 활용한다.
- 개발은 `build` + bind mount, 프로덕션은 `image` + 버전 고정이 일반적인 패턴이다.

---

**지난 글:** [Docker Compose services 완전 정복](/posts/compose-services/)

**다음 글:** [Docker Compose volumes](/posts/compose-volumes/)

<br>
읽어주셔서 감사합니다. 😊
