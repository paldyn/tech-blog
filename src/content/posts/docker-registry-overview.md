---
title: "Docker 레지스트리 완전 정복: 개념과 구조"
description: "Docker 레지스트리의 개념, OCI Distribution Spec, 이미지 이름 구조, 주요 레지스트리 비교(Docker Hub·ECR·GHCR·GCR·Harbor), pull/push 흐름을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "registry", "dockerhub", "ECR", "GHCR", "OCI", "이미지", "배포"]
featured: false
draft: false
---

[지난 글](/posts/docker-secret-leak-prevention/)에서 이미지 내 시크릿 유출을 방지하는 방법을 다뤘다. 안전하게 만든 이미지는 레지스트리에 저장하고 배포한다. 이번 글에서는 레지스트리가 무엇인지, 어떤 구조로 동작하는지, 주요 레지스트리를 어떻게 비교하는지 살펴본다.

## 레지스트리란 무엇인가

레지스트리(Registry)는 Docker 이미지를 저장하고 배포하는 서버다. Git 저장소가 코드를 저장하듯, 레지스트리는 이미지 레이어와 메타데이터를 저장한다.

기본 구조는 세 층으로 이루어진다:
- **Registry**: 레지스트리 서버 자체 (docker.io, ghcr.io 등)
- **Repository**: 한 이미지의 모든 태그 묶음 (`myorg/myapp`)
- **Image**: 특정 태그나 digest로 지정된 이미지 (`myorg/myapp:v1.2.3`)

![Docker 레지스트리 전체 구조](/assets/posts/docker-registry-overview-arch.svg)

## OCI Distribution Spec

레지스트리는 Open Container Initiative(OCI)의 Distribution Specification을 따른다. 이 덕분에 Docker Hub, ECR, GHCR, Harbor 등 서로 다른 레지스트리가 동일한 `docker pull/push` 명령으로 동작한다.

핵심 API 엔드포인트:

```bash
# 이미지 manifest 조회
GET /v2/{name}/manifests/{reference}
# 레이어 blob 다운로드
GET /v2/{name}/blobs/{digest}
# 이미지 태그 목록
GET /v2/{name}/tags/list
# 레지스트리 연결 확인
GET /v2/
```

```bash
# 직접 API 호출 예시 (Docker Hub)
TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/nginx:pull" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
curl -H "Authorization: Bearer $TOKEN" \
  "https://registry-1.docker.io/v2/library/nginx/tags/list"
```

## 이미지 이름 구조

![이미지 이름 구조 해석](/assets/posts/docker-registry-overview-naming.svg)

이미지 이름의 각 부분이 생략되면 기본값이 채워진다:

| 입력 | 실제 의미 |
|---|---|
| `nginx` | `docker.io/library/nginx:latest` |
| `myorg/app` | `docker.io/myorg/app:latest` |
| `myorg/app:v2` | `docker.io/myorg/app:v2` |
| `ghcr.io/myorg/app` | `ghcr.io/myorg/app:latest` |

```bash
# 이미지 full reference 확인
docker inspect nginx --format '{{.RepoDigests}}'
# [nginx@sha256:abc123...]

# digest로 정확히 지정 (태그는 변할 수 있지만 digest는 불변)
docker pull nginx@sha256:abc123def456...
```

## pull/push 동작 흐름

```bash
# push 과정
docker build -t ghcr.io/myorg/myapp:v1.0.0 .
docker login ghcr.io -u myuser -p $TOKEN
docker push ghcr.io/myorg/myapp:v1.0.0

# 내부에서 일어나는 일:
# 1. 각 레이어 존재 여부 확인 (HEAD /v2/{name}/blobs/{digest})
# 2. 없는 레이어만 업로드 (POST /v2/{name}/blobs/uploads/)
# 3. manifest 업로드 (PUT /v2/{name}/manifests/{tag})
```

레이어는 content-addressable storage로 관리된다. 동일한 레이어(sha256 같음)는 레지스트리에 한 번만 저장되고, 여러 이미지 태그가 공유한다.

## 주요 레지스트리 비교

### Docker Hub (docker.io)

기본 레지스트리. `FROM nginx`처럼 레지스트리 없이 쓰면 Docker Hub를 가리킨다.

- 퍼블릭 이미지: 무료 무제한
- 프라이빗 이미지: 무료 플랜 1개 레포
- **Rate limit**: 익명 100회/6시간, 인증 200회/6시간 (프리 플랜)
- Official Images: `library/nginx`, `library/python` 등 검증된 공식 이미지

### GitHub Container Registry (ghcr.io)

GitHub Actions와 네이티브 통합.

```bash
# GitHub Actions에서 로그인
echo "${{ secrets.GITHUB_TOKEN }}" | \
  docker login ghcr.io -u "${{ github.actor }}" --password-stdin

# 패키지 가시성: repo와 연동 또는 독립 설정
```

퍼블릭 리포 이미지는 무료 무제한 pull. 프라이빗은 GitHub Actions 분 제한에 포함.

### AWS ECR

AWS 환경에서 가장 많이 쓰인다.

```bash
# ECR 로그인 (임시 토큰, 12시간 유효)
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.ap-northeast-2.amazonaws.com

# ECR Public Gallery (퍼블릭)
docker pull public.ecr.aws/nginx/nginx:latest
```

IAM 권한으로 접근 제어. ECR 이미지 취약점 스캔 내장.

### GCP Artifact Registry (*.pkg.dev)

GCR의 후속으로, 멀티 리전과 더 세밀한 IAM 지원.

```bash
gcloud auth configure-docker asia-northeast3-docker.pkg.dev
docker push asia-northeast3-docker.pkg.dev/project-id/repo/myapp:v1
```

### Harbor (셀프 호스팅)

오픈소스 레지스트리. 온프레미스나 프라이빗 클라우드 환경.

```bash
docker run -d --name registry -p 5000:5000 registry:2
docker tag myapp:latest localhost:5000/myapp:latest
docker push localhost:5000/myapp:latest
```

## 레지스트리 선택 기준

```
팀이 GitHub 중심으로 일한다면:   GHCR
AWS 인프라를 쓴다면:             ECR
GCP 인프라를 쓴다면:             Artifact Registry
온프레미스/사내 망이라면:        Harbor
공개 오픈소스 프로젝트:          Docker Hub
```

---

**지난 글:** [Docker 이미지에서 시크릿 유출 방지하기](/posts/docker-secret-leak-prevention/)

**다음 글:** [Docker Hub 완전 정복: pull, push, 태그, Rate Limit](/posts/docker-hub-basics/)

<br>
읽어주셔서 감사합니다. 😊
