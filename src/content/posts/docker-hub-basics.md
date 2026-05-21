---
title: "Docker Hub 완전 정복: pull, push, 태그, Rate Limit"
description: "Docker Hub 계정 설정, 이미지 pull/push, 태그 전략, Rate Limit 원인과 해결책, Automated Build, Organizations까지 Docker Hub 핵심 기능을 모두 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerhub", "registry", "tag", "ratelimit", "push", "pull", "배포"]
featured: false
draft: false
---

[지난 글](/posts/docker-registry-overview/)에서 레지스트리의 개념과 전반적인 구조를 살펴봤다. 이번에는 가장 많이 쓰이는 퍼블릭 레지스트리인 **Docker Hub**를 실용적으로 파고든다. Pull/Push 기본 작업부터 CI에서 자주 만나는 Rate Limit 해결법까지 다룬다.

## Docker Hub 계정 설정

```bash
# Docker Hub 로그인
docker login
# 또는 인증 정보 명시
docker login -u myusername
# 비밀번호 대신 Access Token 사용 권장 (Settings → Security → New Access Token)

# 로그아웃
docker logout

# 로그인 상태 확인
cat ~/.docker/config.json | python3 -m json.tool
```

프로덕션 환경이나 CI에서는 패스워드 대신 Access Token을 쓴다. 토큰은 권한 범위(`read-only`, `read-write`, `delete`)를 제한할 수 있다.

## 이미지 pull

```bash
# 최신 태그
docker pull nginx

# 특정 태그
docker pull nginx:1.25-alpine

# Digest로 정확한 버전 지정 (재현 가능한 빌드에 권장)
docker pull nginx@sha256:abc123...

# 멀티 아키텍처 이미지의 특정 플랫폼
docker pull --platform linux/arm64 nginx:latest
```

Docker Hub 공식 이미지(`library/nginx`, `library/python` 등)는 Docker가 직접 관리하며, 정기적으로 보안 패치가 이루어진다.

## 이미지 push

```bash
# 이미지에 Docker Hub 사용자명 포함된 태그 필요
docker build -t myusername/myapp:v1.0.0 .
docker push myusername/myapp:v1.0.0

# 여러 태그 한꺼번에 push
docker tag myusername/myapp:v1.0.0 myusername/myapp:latest
docker push myusername/myapp:latest
```

Organizations 계정이라면 `orgname/reponame:tag` 형식을 사용한다.

![Docker Hub 기본 워크플로](/assets/posts/docker-hub-basics-workflow.svg)

## 태그 전략

`latest` 태그만 사용하는 것은 안티패턴이다. 롤백이 불가능하고, 어떤 버전인지 추적하기 어렵다.

권장 태그 패턴:

```bash
# Git 태그 기반 (릴리즈)
docker tag myapp:build myusername/myapp:1.2.3
docker tag myapp:build myusername/myapp:1.2
docker tag myapp:build myusername/myapp:1
docker tag myapp:build myusername/myapp:latest

# Git 커밋 해시 기반 (CI 빌드)
GIT_SHA=$(git rev-parse --short HEAD)
docker tag myapp:build myusername/myapp:${GIT_SHA}
docker tag myapp:build myusername/myapp:main
```

이렇게 하면:
- `myapp:1.2.3` → 정확한 릴리즈 버전 (불변)
- `myapp:1.2` → 1.2.x 최신 (패치 업데이트 자동 적용)
- `myapp:latest` → 최신 안정 버전

## Rate Limit 문제

![Rate Limit 해결 전략](/assets/posts/docker-hub-basics-ratelimit.svg)

CI에서 가장 자주 만나는 오류가 Rate Limit다:

```
toomanyrequests: You have reached your pull rate limit.
You may increase the limit by authenticating and upgrading: https://www.docker.com/increase-rate-limit
```

### 현재 제한 확인

```bash
# 익명으로 남은 횟수 확인
TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl -s -I -H "Authorization: Bearer $TOKEN" "https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest" | grep -i ratelimit
# RateLimit-Limit: 100;w=21600
# RateLimit-Remaining: 67;w=21600
```

### 해결책: 로그인 (가장 간단)

```yaml
# GitHub Actions
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

로그인하면 IP가 아닌 계정 기준으로 제한이 올라간다 (Free: 200회, Pro+: 무제한).

### 해결책: 미러 레지스트리

조직 내에서 Docker Hub 이미지를 미리 GHCR이나 ECR에 복사해두고 그곳에서 pull하면 Rate Limit를 완전히 우회할 수 있다.

```bash
# skopeo로 이미지 복사 (Docker 데몬 없이도 가능)
skopeo copy docker://nginx:latest \
  docker://ghcr.io/myorg/mirror/nginx:latest
```

## Dockerfile에서 이미지 버전 고정

```dockerfile
# 나쁜 예: 재현 불가, Rate Limit 1회 소모
FROM node:latest

# 좋은 예: 버전 고정
FROM node:20.14.0-alpine3.20

# 가장 좋은 예: digest로 고정 (완전 불변)
FROM node:20-alpine@sha256:abc123def456...
```

## Organizations와 Teams

Organizations 계정에서는 Teams로 레포 접근을 관리한다:

```bash
# Organization 이미지 push
docker push myorg/backend:v2.0.0

# 접근 제어: docker.io에서 Teams → Permissions 설정
# - Read: pull만
# - Write: pull + push
# - Admin: 전체 권한
```

## Automated Builds vs CI 직접 빌드

Docker Hub의 Automated Build(GitHub 연동 자동 빌드)는 현재 유료 플랜에서만 지원된다. 대부분의 팀은 GitHub Actions나 GitLab CI에서 직접 빌드 후 push하는 방식을 사용한다.

```yaml
# GitHub Actions: build-push-action v6
- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: |
      myusername/myapp:latest
      myusername/myapp:${{ github.sha }}
```

---

**지난 글:** [Docker 레지스트리 완전 정복: 개념과 구조](/posts/docker-registry-overview/)

**다음 글:** [프라이빗 레지스트리 구축과 운영](/posts/docker-private-registry/)

<br>
읽어주셔서 감사합니다. 😊
