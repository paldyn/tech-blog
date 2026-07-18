---
title: "Docker Hub 이미지 Pull Rate Limit 해결"
description: "Docker Hub의 IP·계정별 Rate Limit 정책을 이해하고, 로그인, 미러 레지스트리, CI 캐싱, 프라이빗 레지스트리 등 실전 대응 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "rate-limit", "docker-hub", "registry", "CI", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-no-space-left/)에서 디스크 부족 문제를 해결했다. 이번에는 CI/CD 파이프라인에서 특히 자주 발생하는 **이미지 Pull Rate Limit** 에러를 다룬다. Docker Hub는 2020년부터 IP당 Pull 횟수를 제한하는데, 이를 모르고 있다가 CI가 갑자기 실패하면 당황스럽다.

## 에러 메시지

```text
Error response from daemon: toomanyrequests:
You have reached your pull rate limit.
You may increase the limit by authenticating and upgrading:
https://www.docker.com/increase-rate-limit
```

HTTP 응답으로는 **429 Too Many Requests**가 반환된다. Rate Limit은 6시간 단위 슬라이딩 윈도우로 적용된다.

## Rate Limit 정책

![Docker Hub Rate Limit 구조](/assets/posts/docker-image-pull-rate-limit-overview.svg)

| 사용자 유형 | 기준 | 제한 |
|---|---|---|
| 익명 (비로그인) | IP 주소 | 100 pulls / 6시간 |
| 무료 계정 | Docker Hub 계정 | 200 pulls / 6시간 |
| 유료 계정 (Pro/Team) | 계정 | 무제한 |

CI/CD 환경에서 문제가 되는 이유: 여러 파이프라인이 **같은 공인 IP**를 공유한다. GitHub Actions의 hosted runner는 GitHub 소유 IP를 쓰므로 수많은 워크플로우가 동일 IP를 나눠 쓴다. 익명이면 100회 제한을 순식간에 소진한다.

## 현재 상태 확인

```bash
# Docker Hub API로 현재 Rate Limit 헤더 확인
TOKEN=$(curl -s \
  "https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s --head \
  -H "Authorization: Bearer $TOKEN" \
  "https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest" \
  | grep -i ratelimit
```

응답 헤더 예시:
```text
RateLimit-Limit: 100;w=21600
RateLimit-Remaining: 76;w=21600
```

`RateLimit-Remaining`이 0에 가까우면 곧 제한된다.

## 해결 방법

![Rate Limit 우회 전략 비교](/assets/posts/docker-image-pull-rate-limit-solutions.svg)

### 방법 1: Docker Hub 로그인 (가장 간단)

```bash
docker login
# 이후 200 pulls/6h (무료) 또는 무제한 (유료)

docker pull nginx:alpine
```

CI/CD에서는 환경변수로 자격증명을 전달한다.

```yaml
# GitHub Actions 예시
- name: Docker Hub 로그인
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

토큰은 계정 비밀번호 대신 **Access Token**을 사용한다(Docker Hub → Account Settings → Security).

### 방법 2: 레지스트리 미러 설정

```json
// /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://registry.k8s.io"
  ]
}
```

```bash
sudo systemctl restart docker
```

`mirror.gcr.io`는 Google Container Registry의 Docker Hub 미러다. 공식 이미지(`library/*`)에 한해 캐시를 제공한다.

### 방법 3: 이미지를 한 번 pull 후 프라이빗 레지스트리로 복사

```bash
# 원본 pull
docker pull nginx:1.25-alpine

# 프라이빗 레지스트리로 태그
docker tag nginx:1.25-alpine myregistry.company.com/nginx:1.25-alpine

# 프라이빗으로 push
docker push myregistry.company.com/nginx:1.25-alpine
```

이후 CI는 Docker Hub 대신 프라이빗 레지스트리를 사용한다. **Rate Limit 완전 우회**다.

### 방법 4: GitHub Actions 레이어 캐시 활용

```yaml
- name: 빌드 캐시 설정
  uses: docker/setup-buildx-action@v3

- name: 이미지 빌드 (GitHub 캐시 재사용)
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
    push: true
    tags: myapp:latest
```

`type=gha`는 GitHub Actions 캐시를 레이어 캐시로 사용한다. 이미지 레이어가 캐시되면 베이스 이미지를 Docker Hub에서 다시 내려받지 않아도 된다.

## AWS ECR / GCP Artifact Registry 활용

클라우드 환경이라면 관리형 레지스트리를 활용한다.

```bash
# AWS ECR 로그인
aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS \
    --password-stdin 123456789.dkr.ecr.ap-northeast-2.amazonaws.com

# ECR로 이미지 복사
docker pull node:20-alpine
docker tag node:20-alpine 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/node:20-alpine
docker push 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/node:20-alpine
```

ECR은 AWS 내부 트래픽이므로 Rate Limit이 없고, 동일 리전 내 Pull은 빠르다.

## 요약

CI/CD에서 Rate Limit이 걸린다면 우선 **Docker Hub 로그인**을 적용해 익명 제한에서 벗어난다. 장기적으로는 자주 쓰는 베이스 이미지를 **프라이빗 레지스트리**에 복사해 두고, 빌드 시 **레이어 캐시**를 적극 활용한다.

---

**지난 글:** [Docker No space left on device 에러 해결](/posts/docker-no-space-left/)

**다음 글:** [Docker 네트워크 충돌 해결](/posts/docker-network-conflict/)

<br>
읽어주셔서 감사합니다. 😊
