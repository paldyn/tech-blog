---
title: "Skopeo — pull 없이 이미지 복사·검사하는 도구"
description: "Skopeo로 Docker 데몬 없이 레지스트리 간 이미지를 복사하고, pull 없이 메타데이터를 조회하며, 이미지 동기화·서명 검증까지 실무 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "skopeo", "registry", "image-copy", "oci", "podman", "container-tools"]
featured: false
draft: false
---

[지난 글](/posts/docker-buildah/)에서 Buildah로 이미지를 빌드하는 방법을 살펴봤다. 이번에는 **Skopeo**를 다룬다. Skopeo는 이미지를 실행하거나 빌드하지 않고, **이미지 복사·검사·동기화에 특화**된 도구다. Docker 데몬 없이 레지스트리 API와 직접 통신한다.

## Skopeo란

Skopeo는 Red Hat의 컨테이너 툴킷(Podman, Buildah, Skopeo) 중 하나다. "스코페오"라고 읽으며 그리스어로 "관찰하다"를 뜻한다. 이름처럼 이미지를 **로컬에 저장하지 않고** 레지스트리에서 직접 정보를 읽거나 복사한다.

```bash
# Skopeo 설치
sudo apt install skopeo        # Ubuntu
sudo dnf install skopeo        # RHEL/Fedora

# 버전 확인
skopeo --version
```

## 핵심 특징: 레이어 스트리밍

Docker의 `docker pull` + `docker push`는 로컬 스토어를 거치지만, Skopeo의 `copy`는 **소스 레지스트리에서 목적지 레지스트리로 레이어를 직접 스트리밍**한다. 중간에 디스크 공간을 거의 사용하지 않는다.

![Skopeo 이미지 전송 매트릭스](/assets/posts/docker-skopeo-copy.svg)

## skopeo copy — 이미지 복사

```bash
# Docker Hub → 프라이빗 레지스트리
skopeo copy \
  docker://nginx:latest \
  docker://myregistry.io/nginx:latest

# 프라이빗 레지스트리 인증
skopeo copy \
  --src-creds user:password \
  --dest-creds user:password \
  docker://src-registry.io/myapp:v1.0 \
  docker://dst-registry.io/myapp:v1.0

# 로컬 Docker 스토어 → 레지스트리
skopeo copy \
  docker-daemon:myapp:latest \
  docker://myregistry.io/myapp:latest

# OCI 아카이브로 저장 (Air-gapped 환경용)
skopeo copy \
  docker://nginx:latest \
  oci-archive:/tmp/nginx.tar

# OCI 아카이브 → 레지스트리 복원
skopeo copy \
  oci-archive:/tmp/nginx.tar \
  docker://myregistry.io/nginx:latest

# Docker 호환 아카이브 (docker load 가능)
skopeo copy \
  docker://nginx:latest \
  docker-archive:/tmp/nginx-docker.tar
```

## skopeo inspect — pull 없이 조회

이미지를 로컬에 받지 않고 레지스트리 API로 메타데이터를 조회한다.

![Skopeo inspect 명령어](/assets/posts/docker-skopeo-inspect.svg)

```bash
# 기본 조회 (레이어 목록, 환경변수, CMD 등)
skopeo inspect docker://nginx:latest

# JSON 파싱 예시
skopeo inspect docker://nginx:latest | jq '{
  digest: .Digest,
  os: .Os,
  arch: .Architecture,
  layers: .Layers | length
}'

# 특정 아키텍처 이미지 조회
skopeo inspect \
  --override-arch=arm64 \
  --override-os=linux \
  docker://nginx:latest
```

## skopeo sync — 레지스트리 동기화

여러 이미지를 한 레지스트리에서 다른 레지스트리로 대량 동기화한다. Air-gapped 환경에서 내부 미러를 구성할 때 유용하다.

```bash
# 레지스트리 → 디렉터리 동기화
skopeo sync \
  --src docker \
  --dest dir \
  myregistry.io/myapp \
  /tmp/mirror/

# 디렉터리 → 레지스트리 복원
skopeo sync \
  --src dir \
  --dest docker \
  /tmp/mirror/ \
  private-registry.internal/

# YAML 파일로 다중 이미지 동기화
# sync.yaml:
# myregistry.io:
#   images:
#     nginx: ["1.25", "1.24", "latest"]
#     redis: ["7.0", "7.2"]
skopeo sync \
  --src yaml \
  --dest docker \
  sync.yaml \
  private-registry.internal/
```

## skopeo delete — 이미지 삭제

```bash
# 레지스트리에서 이미지 태그 삭제
skopeo delete docker://myregistry.io/myapp:old-tag

# 다이제스트로 삭제 (태그 없는 경우)
skopeo delete \
  docker://myregistry.io/myapp@sha256:abc123...
```

## 서명 검증

Cosign이나 GPG 서명이 붙은 이미지를 검증하는 정책과 함께 사용할 수 있다.

```bash
# 정책 파일 지정 (Signature 검증 포함)
skopeo copy \
  --policy /etc/containers/policy.json \
  docker://myregistry.io/myapp:latest \
  oci:/tmp/myapp

# 서명 없는 이미지 허용 정책 확인
cat /etc/containers/policy.json
```

## CI/CD 활용 패턴

```bash
# 1. CI에서 빌드 후 레지스트리로 push (데몬 없이)
buildah bud -t myapp:$CI_COMMIT_SHA .
skopeo copy \
  containers-storage:myapp:$CI_COMMIT_SHA \
  docker://myregistry.io/myapp:$CI_COMMIT_SHA

# 2. 이미지 존재 여부 확인 (pull 없이)
if skopeo inspect docker://myregistry.io/myapp:$TAG > /dev/null 2>&1; then
  echo "이미지 존재 — 빌드 스킵"
else
  echo "이미지 없음 — 빌드 필요"
fi

# 3. 프로덕션 배포 전 다이제스트 고정
DIGEST=$(skopeo inspect docker://myregistry.io/myapp:latest \
  | jq -r .Digest)
echo "배포 대상: myapp@$DIGEST"
```

---

**지난 글:** [Buildah — 데몬 없이 컨테이너 이미지 빌드](/posts/docker-buildah/)

**다음 글:** [OCI 스펙 — 컨테이너 표준화의 기반](/posts/docker-oci-spec/)

<br>
읽어주셔서 감사합니다. 😊
