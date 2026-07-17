---
title: "Docker 이미지 Digest — 불변 참조의 핵심"
description: "이미지 Digest(SHA256 해시)가 태그와 어떻게 다른지, --digests 옵션으로 조회하는 방법, Digest로 pull하고 Dockerfile에서 참조하는 방법, 재현 가능한 배포에 Digest가 왜 중요한지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "digest", "sha256", "불변", "재현성", "보안", "image"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-layers/)에서 이미지가 레이어로 구성된다는 것을 살펴봤다. 이번에는 그 이미지를 **정확히** 특정할 수 있는 Digest에 대해 알아본다. 태그(`nginx:latest`)는 편리하지만 시간이 지나면 가리키는 이미지가 달라질 수 있다. Digest는 이미지 내용 자체에서 계산된 SHA256 해시로, 내용이 같으면 항상 같고 내용이 조금이라도 달라지면 완전히 다른 값이 된다. 보안과 재현성이 중요한 환경에서 Digest는 태그보다 신뢰할 수 있는 이미지 참조 방법이다.

## Digest란 무엇인가

Docker 이미지는 매니페스트(manifest)로 구성된다. 매니페스트는 이미지를 이루는 레이어 목록과 설정 파일의 해시로 구성된 JSON 문서다. Digest는 이 매니페스트 전체의 SHA256 해시다.

```text
이미지 = 매니페스트 + 레이어들
Digest = SHA256(매니페스트)
```

이미지 내용이 바뀌면 매니페스트가 바뀌고, 따라서 Digest도 바뀐다. 같은 Digest라면 완전히 동일한 이미지임이 수학적으로 보장된다.

## 태그와 Digest의 차이

태그는 단순한 이름표다. 레지스트리 운영자가 언제든지 같은 태그가 다른 이미지를 가리키도록 바꿀 수 있다.

```bash
# 오늘의 nginx:latest → abc123
docker pull nginx:latest
# SHA256: abc123...

# 일주일 뒤의 nginx:latest → def456
docker pull nginx:latest
# SHA256: def456...  ← 다른 이미지!
```

Digest는 콘텐츠에서 계산되므로 바뀌지 않는다. `sha256:abc123...`이라는 Digest가 오늘이나 일 년 뒤나 항상 같은 이미지를 가리킨다.

![태그 vs Digest 비교](/assets/posts/docker-image-digest-vs-tag.svg)

## Digest 확인 방법

```bash
# 이미지 목록에서 Digest 포함 출력
docker images --digests nginx

# inspect로 상세 Digest 확인
docker inspect nginx:latest \
  --format '{{.RepoDigests}}'

# pull 시 Digest 표시됨
docker pull nginx:latest
# Digest: sha256:abc123...
```

`docker pull` 명령 출력에서 항상 Digest를 확인할 수 있다. 이 값을 기록해두면 나중에 정확히 같은 이미지를 재현할 수 있다.

## Digest로 이미지 pull하기

`@sha256:` 문법으로 특정 Digest의 이미지만 pull할 수 있다.

```bash
# Digest로 정확한 이미지 pull
docker pull nginx@sha256:abc123def456...

# pull 후 태그 붙이기
docker tag nginx@sha256:abc123... nginx:pinned
```

Digest로 pull하면 레지스트리가 이미지를 교체해도 항상 원하는 이미지를 얻을 수 있다.

## Dockerfile에서 Digest 사용

```dockerfile
# 태그 사용 (가변적)
FROM nginx:1.25

# Digest 사용 (불변)
FROM nginx@sha256:abc123def456...

# 둘 다 명시 (권장 — 가독성 + 불변성)
FROM nginx:1.25@sha256:abc123def456...
```

태그와 Digest를 같이 쓰면 사람이 읽기 쉬운 태그 이름을 유지하면서 내용의 불변성도 보장된다.

![Digest 조회 및 활용 명령](/assets/posts/docker-image-digest-commands.svg)

## 멀티 아키텍처 이미지의 Digest

멀티 아키텍처 이미지(Manifest List)는 두 종류의 Digest를 가진다.

- **Manifest List Digest**: 모든 플랫폼을 묶는 상위 Digest
- **플랫폼별 Digest**: 각 아키텍처(amd64, arm64 등)의 개별 이미지 Digest

`docker pull nginx:latest`를 실행할 때 출력되는 Digest는 Manifest List Digest다. 실제로 다운로드된 플랫폼별 이미지의 Digest와 다를 수 있다.

```bash
# 모든 플랫폼의 Digest 조회
docker manifest inspect nginx:latest | jq '.manifests[].digest'
```

## 보안 관점에서의 Digest

Digest를 사용하면 이미지 무결성을 검증할 수 있다.

- 레지스트리가 해킹당해 이미지가 교체되어도 Digest가 달라지므로 탐지 가능
- CI/CD에서 특정 Digest로 고정하면 의도치 않은 이미지 변경 방지
- `docker trust` 또는 Cosign과 조합하면 서명 기반 이미지 검증도 가능

프로덕션 배포에서 `latest` 태그를 쓰는 것은 어떤 이미지를 배포할지 통제권을 잃는 것과 같다. 최소한 명확한 버전 태그를, 더 안전하게는 Digest를 사용하는 것이 모범 사례다.

---

**지난 글:** [Docker 이미지 레이어 구조 이해하기](/posts/docker-image-layers/)

**다음 글:** [멀티 아키텍처 이미지와 docker buildx](/posts/docker-image-platform-multi-arch/)

<br>
읽어주셔서 감사합니다. 😊
