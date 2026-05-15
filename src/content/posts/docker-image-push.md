---
title: "docker image push — 이미지 올리기"
description: "docker push 명령으로 로컬 이미지를 Docker Hub와 private registry에 업로드하는 방법, 레이어 재사용 원리, CI/CD 환경에서의 인증과 버전 관리 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "push", "registry", "cicd"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-pull/)에서 이미지를 내려받는 방법을 살펴봤다. 이번에는 반대 방향인 `docker push`로 로컬 이미지를 레지스트리에 업로드하는 방법을 정리한다. pull과 동일한 레이어 공유 메커니즘 덕분에 변경된 레이어만 전송되므로 효율적이다.

## push 전 준비

push하기 전에 두 가지를 반드시 확인해야 한다.

**1. 로그인:** 레지스트리에 인증되어 있어야 한다.

```bash
# Docker Hub 로그인
docker login

# Private registry 로그인
docker login registry.example.com
```

**2. 이미지 이름 형식:** 이미지 이름에 레지스트리 주소와 네임스페이스가 포함되어야 한다.

```
[registry/][namespace/]name:tag
```

Docker Hub의 경우 `네임스페이스`는 계정명(또는 조직명)이다. 생략하면 Docker Hub의 공식 이미지 네임스페이스(`library/`)로 해석되어 push 권한이 없다.

## 기본 push 흐름

```bash
# 빌드
docker build -t myapp:v1.0.0 .

# Docker Hub 업로드를 위한 태그 지정
docker tag myapp:v1.0.0 myusername/myapp:v1.0.0

# push
docker push myusername/myapp:v1.0.0
```

push 출력에서 `Layer already exists`는 레지스트리가 이미 해당 레이어를 보유하고 있다는 의미다. 베이스 이미지 레이어는 대부분 이미 있으므로, 실제로 업로드되는 것은 애플리케이션 코드 레이어뿐인 경우가 많다.

![push 동작 흐름](/assets/posts/docker-image-push-flow.svg)

## 버전과 latest 동시 관리

배포 시에는 구체적인 버전 태그와 `latest` 태그를 함께 push하는 것이 관례다.

```bash
VERSION=v1.0.0
IMAGE=myusername/myapp

docker build -t $IMAGE:$VERSION .
docker tag $IMAGE:$VERSION $IMAGE:latest

docker push $IMAGE:$VERSION
docker push $IMAGE:latest
```

`latest`는 최신 안정 버전을 가리키는 컨벤션이다. Docker가 자동으로 관리하지 않으므로 직접 태그를 붙여 push해야 한다.

![push 명령 패턴](/assets/posts/docker-image-push-commands.svg)

## Private Registry push

GitHub Container Registry(ghcr.io), AWS ECR, GCP Artifact Registry 등 private registry에 push하는 패턴은 동일하다. 레지스트리 주소를 이미지 이름 앞에 붙이는 것이 핵심이다.

```bash
# GitHub Container Registry
docker login ghcr.io -u $GITHUB_ACTOR \
  --password-stdin <<< "$GITHUB_TOKEN"

docker tag myapp ghcr.io/myorg/myapp:v1.0.0
docker push ghcr.io/myorg/myapp:v1.0.0
```

비밀번호를 명령행 인수로 직접 전달하면 셸 히스토리에 남으므로, `--password-stdin`으로 파이프 또는 here-string을 통해 전달하는 것이 안전하다.

## CI/CD 환경에서의 push

CI 환경에서는 자격증명을 환경 변수로 관리한다.

```bash
# GitHub Actions 예시 (secrets 활용)
docker login -u "${{ secrets.DOCKER_USERNAME }}" \
  --password-stdin <<< "${{ secrets.DOCKER_PASSWORD }}"
```

`docker/login-action`처럼 레지스트리별 공식 Action을 활용하면 토큰 관리가 더 안전하다. AWS ECR의 경우 OIDC 기반 인증으로 장기 토큰 없이도 push할 수 있다.

## --all-tags

로컬에 같은 이름으로 여러 태그가 붙은 이미지가 있을 때 한 번에 push할 수 있다.

```bash
docker push --all-tags myusername/myapp
# v1.0.0, v1.0.1, latest 태그 모두 push
```

주의: 실수로 테스트용 태그가 올라갈 수 있으므로 로컬 태그 목록을 먼저 확인하는 것이 좋다.

```bash
docker images myusername/myapp
```

---

**지난 글:** [docker image pull — 이미지 내려받기](/posts/docker-image-pull/)

**다음 글:** [docker image tag — 이미지 태그 관리](/posts/docker-image-tag/)

<br>
읽어주셔서 감사합니다. 😊
