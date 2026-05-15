---
title: "docker image tag — 이미지 태그 관리"
description: "docker tag 명령으로 이미지에 새 이름과 태그를 부여하는 방법, 이미지 참조 구조(registry/namespace/name:tag), 태그 전략(SemVer, Git SHA, 환경별), CI 자동 태깅 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "tag", "naming", "cicd"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-push/)에서 이미지를 레지스트리에 업로드하는 방법을 다뤘다. 이번에는 `docker tag`로 이미지에 새 이름을 부여하는 방법과, 이미지 이름의 구조, 그리고 실전에서 사용하는 태그 전략을 살펴본다.

## 이미지 참조 구조

Docker 이미지의 완전한 참조 형식은 다음과 같다.

```
[registry/][namespace/]name[:tag][@digest]
```

- **registry:** 레지스트리 주소 (생략 시 `docker.io`)
- **namespace:** 계정/조직명 (공식 이미지는 `library`)
- **name:** 이미지 이름
- **tag:** 버전 레이블 (생략 시 `latest`)
- **digest:** 콘텐츠 기반 해시, tag와 함께 또는 단독 사용 가능

```
nginx                              → docker.io/library/nginx:latest
myorg/myapp:v1.2.3                → docker.io/myorg/myapp:v1.2.3
ghcr.io/company/app:sha256:abc..  → ghcr.io의 특정 digest
```

![이미지 태그 구조](/assets/posts/docker-image-tag-naming.svg)

## docker tag 기본 사용법

`docker tag`는 기존 이미지에 새 이름(별칭)을 부여한다. 레이어를 복사하지 않으므로 즉시 실행된다.

```bash
# 기본 형식
docker tag <SOURCE> <TARGET>

# 로컬 이름에서 push 가능한 이름으로
docker tag myapp:v1.2.3 myusername/myapp:v1.2.3

# 같은 이미지에 latest 태그 추가
docker tag myusername/myapp:v1.2.3 myusername/myapp:latest

# 이미지 ID로 태그 부여
docker tag a1b2c3d4e5f6 myapp:stable
```

태그는 이미지 레이어를 가리키는 **포인터**다. 같은 이미지에 여러 태그를 붙여도 디스크 공간은 변하지 않는다.

![tag 명령 패턴](/assets/posts/docker-image-tag-commands.svg)

## 태그 전략

**SemVer 패턴:**

```
myapp:1.2.3     # 정확한 버전
myapp:1.2       # 마이너 버전 floating
myapp:1         # 메이저 버전 floating
myapp:latest    # 최신 안정
```

고정 태그(`1.2.3`)와 부동 태그(`latest`)를 함께 유지하면, 사용자가 최신 버전을 추적할 수도 있고 정확한 버전을 고정할 수도 있다.

**Git 기반 패턴:**

```bash
SHA=$(git rev-parse --short HEAD)
docker build -t myapp:$SHA .
docker tag myapp:$SHA myapp:latest
docker tag myapp:$SHA myapp:$(git rev-parse --abbrev-ref HEAD)
```

커밋 SHA를 태그로 사용하면 어떤 코드로 빌드된 이미지인지 추적할 수 있다.

**베이스 이미지 변형 구분:**

```
myapp:1.2.3           # 기본 Debian 베이스
myapp:1.2.3-alpine    # Alpine 베이스 (더 작음)
myapp:1.2.3-slim      # slim 변형
myapp:1.2.3-debug     # 디버깅 도구 포함
```

## latest 태그의 함정

`latest`는 Docker가 자동으로 관리하지 않는다. 단순히 `latest`라는 이름의 태그일 뿐이다.

```bash
# 이전 버전을 latest로 실수로 태그할 수 있다
docker tag myapp:v0.9.0 myapp:latest  # 위험!
```

CI/CD 파이프라인에서 `latest` 태그를 기준으로 배포하면 예상치 못한 버전이 배포될 수 있다. 프로덕션 배포는 구체적인 버전 태그 또는 digest를 사용하는 것이 안전하다.

## 멀티 레지스트리 배포

같은 이미지를 여러 레지스트리에 배포할 때 태그를 활용한다.

```bash
IMAGE=myapp:v1.2.3

# Docker Hub
docker tag $IMAGE myusername/myapp:v1.2.3
docker push myusername/myapp:v1.2.3

# GitHub Container Registry
docker tag $IMAGE ghcr.io/myorg/myapp:v1.2.3
docker push ghcr.io/myorg/myapp:v1.2.3

# AWS ECR
docker tag $IMAGE 123456.dkr.ecr.ap-northeast-2.amazonaws.com/myapp:v1.2.3
docker push 123456.dkr.ecr.ap-northeast-2.amazonaws.com/myapp:v1.2.3
```

레이어는 공유되므로 각 레지스트리로 push할 때 변경된 레이어만 전송된다.

---

**지난 글:** [docker image push — 이미지 올리기](/posts/docker-image-push/)

**다음 글:** [docker image ls — 이미지 목록 조회](/posts/docker-image-list/)

<br>
읽어주셔서 감사합니다. 😊
