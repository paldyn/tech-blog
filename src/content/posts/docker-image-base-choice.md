---
title: "베이스 이미지 선택 전략"
description: "docker FROM 명령에서 어떤 베이스 이미지를 선택해야 하는지, debian·alpine·distroless·scratch의 크기·보안·호환성 차이, 공식 이미지 vs 커뮤니티 이미지 판단 기준, 언어별 권장 베이스 이미지를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "base", "alpine", "distroless", "scratch", "debian", "베이스이미지"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-naming-tagging/)에서 이미지 이름과 태그 전략을 살펴봤다. 이번에는 Dockerfile의 첫 줄인 `FROM`에 무엇을 쓸지, 즉 베이스 이미지 선택을 다룬다. 베이스 이미지는 이미지 크기, 보안 취약점 수, 런타임 호환성 모두에 영향을 미친다. 잘못된 선택은 나중에 대규모 리팩토링을 불러오므로, 처음부터 제대로 고르는 것이 중요하다.

## 베이스 이미지가 중요한 이유

베이스 이미지는 최종 이미지 크기의 대부분을 결정한다. debian은 ~120MB, alpine은 ~5MB, distroless는 ~2~20MB, scratch는 0MB다. 크기 차이뿐 아니라 포함된 OS 패키지의 취약점 수도 크게 다르다.

```dockerfile
# 베이스 이미지 선택이 모든 것을 결정한다
FROM debian:bookworm        # 전통적, 크고 편리
FROM debian:bookworm-slim   # 절충안
FROM alpine:3.19            # 경량, 호환성 주의
FROM gcr.io/distroless/base # 보안 최우선
FROM scratch                # 정적 바이너리용
```

## 주요 베이스 이미지 비교

**debian / ubuntu**: 가장 일반적인 선택이다. glibc 기반이라 대부분의 프로그램과 호환된다. 패키지가 풍부하고 셸이 완전해 개발과 디버깅이 쉽다. 다만 크기가 크고 OS 레벨 취약점이 많다.

**debian-slim**: debian에서 문서, 로케일, man 페이지 등 런타임에 불필요한 파일을 제거한 버전이다. glibc 호환성은 그대로 유지하면서 크기를 ~30MB 수준으로 줄였다. 대부분의 언어 런타임 공식 이미지(`python:3.12-slim`, `node:20-slim`)가 이 기반이다.

**alpine**: musl libc와 BusyBox 기반의 경량 배포판이다. ~5MB의 극소 크기가 장점이지만, musl libc는 glibc와 완벽히 호환되지 않는다. C 확장 모듈을 사용하는 Python 패키지, 일부 Node.js 네이티브 모듈, glibc 링크된 바이너리가 문제를 일으킬 수 있다.

**distroless**: Google이 관리하는 최소 런타임 이미지다. 셸, 패키지 관리자, 기타 OS 도구가 없다. 공격 표면이 극히 작아 보안에 유리하다. 단, 디버깅을 위해 컨테이너에 접속할 수 없으므로 애플리케이션 로그와 외부 관찰성 도구에 의존해야 한다.

**scratch**: 빈 이미지다. 아무것도 없다. Go, Rust 등으로 빌드한 정적 링크 바이너리는 scratch 위에서 바로 실행할 수 있다.

![베이스 이미지 비교](/assets/posts/docker-image-base-comparison.svg)

## 공식 이미지 vs 커뮤니티 이미지

Docker Hub의 공식 이미지(Official Images)는 Docker, Inc.와 언어/소프트웨어 커뮤니티가 공동으로 관리한다. 정기적인 보안 업데이트와 검증된 Dockerfile 모범 사례가 적용되어 있다.

```bash
# 공식 이미지 (네임스페이스 없음 또는 library/)
docker pull nginx
docker pull python:3.12

# 커뮤니티 이미지 (네임스페이스 있음)
docker pull bitnami/nginx
```

커뮤니티 이미지는 추가 기능을 제공하지만 업데이트 주기와 보안 대응이 검증되지 않을 수 있다. 프로덕션에서는 가능한 한 공식 이미지를 베이스로 삼는 것이 좋다.

## 언어별 권장 베이스 이미지

**Go**: 정적 링크 바이너리가 기본이므로 `scratch` 또는 `gcr.io/distroless/static`을 사용한다.

```dockerfile
FROM golang:1.22 AS builder
RUN CGO_ENABLED=0 go build -o /app .

FROM scratch
COPY --from=builder /app /app
CMD ["/app"]
```

**Python**: `python:3.12-slim` 또는 `python:3.12-slim-bookworm`이 좋은 출발점이다. 수학/과학 라이브러리가 많은 경우 `python:3.12` 전체 이미지가 더 안정적이다. alpine의 musl로 인해 numpy, pandas 등이 컴파일 오류를 일으킬 수 있다.

**Node.js**: `node:20-slim`이 가장 무난하다. 최소 이미지를 원하면 `node:20-alpine`도 되지만, native addon(node-gyp)이 있으면 alpine에서 빌드 실패가 잦다.

**Java**: 전통적으로 `eclipse-temurin:21-jre-jammy` 같은 JRE만 있는 이미지를 사용한다. GraalVM으로 네이티브 이미지를 빌드하면 distroless나 scratch도 가능하다.

## 보안 스캔으로 비교해보기

```bash
# Trivy로 취약점 개수 비교
trivy image --severity HIGH,CRITICAL nginx:latest
trivy image --severity HIGH,CRITICAL nginx:alpine
```

alpine 기반이 취약점 수가 적은 경향이 있지만, musl 관련 호환성 버그가 보안 취약점보다 운영 위험이 클 수 있다.

![베이스 이미지 선택 결정 흐름](/assets/posts/docker-image-base-decision.svg)

## 멀티 스테이지 빌드와의 조합

빌드 환경과 실행 환경을 분리하면 최소 베이스를 실행 이미지에 쓸 수 있다.

```dockerfile
# 빌드 스테이지: 전체 SDK 포함 이미지
FROM python:3.12 AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# 실행 스테이지: 최소 이미지
FROM python:3.12-slim
COPY --from=builder /install /usr/local
COPY . /app
CMD ["python", "-m", "uvicorn", "main:app"]
```

이 패턴으로 빌드 도구, 헤더 파일, 캐시 등이 최종 이미지에 포함되지 않는다. Dockerfile 시리즈에서 더 자세히 다룬다.

---

**지난 글:** [Docker 이미지 네이밍과 태깅 전략](/posts/docker-image-naming-tagging/)

**다음 글:** [Dockerfile 해부학 — 기본 구조 이해](/posts/dockerfile-anatomy/)

<br>
읽어주셔서 감사합니다. 😊
