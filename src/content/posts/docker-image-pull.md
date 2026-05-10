---
title: "docker image pull — 이미지 내려받기"
description: "docker pull 명령의 동작 흐름, 레이어 캐시 재사용, 태그와 digest 참조 방식, private registry 사용법, Docker Hub rate limit 대응 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "pull", "registry", "rate-limit"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-essence/)에서 Docker 이미지의 레이어 구조와 OverlayFS 원리를 살펴봤다. 이번에는 이미지를 레지스트리에서 내려받는 `docker pull`의 동작 방식과 실용적인 사용법을 정리한다.

## pull 동작 흐름

`docker pull nginx:alpine`을 실행하면 내부적으로 다음 순서로 처리된다.

1. **Manifest 요청:** 레지스트리에서 이미지의 레이어 목록과 각 레이어의 digest를 받아온다.
2. **캐시 확인:** 각 레이어 digest를 로컬 캐시와 비교한다. 이미 있는 레이어는 `Already exists`로 건너뛴다.
3. **병렬 다운로드:** 없는 레이어만 병렬로 다운로드한다. 각 레이어는 tar.gz 형태로 수신되어 압축 해제 후 저장된다.
4. **검증 & 저장:** 다운로드한 레이어의 SHA-256을 검증하고 `/var/lib/docker/overlay2/`에 저장한다.

```
nginx:alpine: Pulling from library/nginx
2a92d6ac9f4c: Already exists   ← 로컬 캐시 재사용
3b94b5a9ea48: Pull complete     ← 새로 다운로드
Status: Downloaded newer image for nginx:alpine
Digest: sha256:a1b2c3...
```

![pull 동작 흐름](/assets/posts/docker-image-pull-flow.svg)

## 기본 사용법

```bash
# 최신 태그 (latest) pull
docker pull nginx

# 특정 버전 지정
docker pull nginx:1.25-alpine

# digest로 정확한 버전 고정
docker pull nginx@sha256:a1b2c3def456...
```

`docker pull nginx`는 `docker pull docker.io/library/nginx:latest`와 동일하다. 레지스트리 주소, 네임스페이스, 태그가 모두 기본값으로 채워진다.

## 태그 vs Digest

태그는 이름이 붙은 참조로 가변(mutable)이다. `nginx:latest`는 언제든 다른 이미지를 가리킬 수 있다.

Digest는 이미지 내용의 SHA-256 해시로 불변(immutable)이다. 프로덕션 배포에서 정확한 버전을 고정하고 싶다면 digest 참조를 사용한다.

```bash
# 현재 nginx:latest의 digest 확인
docker pull nginx:latest
docker inspect nginx:latest --format '{{.RepoDigests}}'
# [nginx@sha256:a1b2c3...]

# CI에서 digest 고정으로 재현성 확보
docker pull nginx@sha256:a1b2c3def456...
```

![pull 명령 패턴](/assets/posts/docker-image-pull-commands.svg)

## Private Registry

Docker Hub 외 레지스트리에서 pull하려면 먼저 로그인이 필요하다.

```bash
# 로그인
docker login registry.example.com

# pull
docker pull registry.example.com/myapp:v1.2.0
```

AWS ECR, GCP Artifact Registry, GitHub Container Registry 등 주요 클라우드 레지스트리는 별도 인증 도구(aws ecr get-login-password 등)로 로그인 토큰을 얻어 사용한다.

```bash
# AWS ECR 로그인 예시
aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin \
    123456789.dkr.ecr.ap-northeast-2.amazonaws.com
```

## --platform 옵션

멀티 아키텍처 이미지에서 특정 플랫폼의 레이어를 명시적으로 지정할 수 있다. Apple M1/M2처럼 ARM 환경에서 amd64 이미지가 필요할 때 유용하다.

```bash
# M1 Mac에서 amd64 이미지 pull
docker pull --platform linux/amd64 nginx:alpine

# linux/arm64 지정
docker pull --platform linux/arm64 nginx:alpine
```

## Docker Hub Rate Limit

Docker Hub는 비인증 요청에 대해 IP당 100회/6시간 제한을 두고 있다. CI/CD 파이프라인에서 자주 만나는 문제다.

```
toomanyrequests: You have reached your pull rate limit
```

**대응 방법:**
- 로그인으로 제한 완화 (200회/6시간, 무료 계정)
- Docker Hub Mirror 또는 사내 레지스트리 프록시 구성
- 이미지를 ECR, GCR 등으로 미러링

```bash
# 현재 남은 rate limit 확인
TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull" | jq -r .token)
curl -s -H "Authorization: Bearer $TOKEN" \
     https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest \
     -I 2>&1 | grep -i ratelimit
```

## --all-tags

특정 이미지의 모든 태그를 한 번에 받아오려면 `--all-tags` 옵션을 쓴다. 태그가 많은 이미지는 시간과 디스크 공간을 많이 소모하므로 주의한다.

```bash
docker pull --all-tags nginx
```

---

**지난 글:** [Docker 이미지의 본질 — 레이어와 유니온 마운트](/posts/docker-image-essence/)

**다음 글:** [docker image push — 이미지 올리기](/posts/docker-image-push/)

<br>
읽어주셔서 감사합니다. 😊
