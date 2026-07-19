---
title: "Scratch 이미지: 절대 최소 컨테이너 만들기"
description: "Docker scratch 이미지의 개념, 정적 Go/Rust 바이너리를 scratch 기반으로 빌드하는 방법, CA 인증서·시간대 처리, 트러블슈팅까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "scratch", "image", "go", "rust", "static-binary", "경량이미지", "보안"]
featured: false
draft: false
---

[지난 글](/posts/docker-alpine-pitfalls/)에서 Alpine 이미지의 함정을 살펴봤다. 이미지 크기를 줄이는 전략에서 가장 극단적인 선택은 **scratch** 이미지다. 말 그대로 아무것도 없는 빈 이미지에서 시작한다.

## scratch는 무엇인가

`scratch`는 Docker에 내장된 특수 이미지로, 파일시스템 레이어가 하나도 없는 빈 이미지다. 크기가 0 bytes이고, 셸도 없고, libc도 없고, 심지어 `/bin` 디렉터리도 없다.

```bash
# scratch 이미지 정보 확인
$ docker inspect scratch 2>&1 | head -5
# Error: No such object: scratch
# scratch는 일반적으로 pull할 수 없음 — Dockerfile에서만 사용 가능
```

`FROM scratch`는 Dockerfile에서 "아무 것도 없는 곳에서 시작"을 의미한다. 이후 `COPY` 명령으로 필요한 파일만 직접 넣는다.

![이미지 크기 비교](/assets/posts/docker-scratch-image-layers.svg)

## scratch가 적합한 경우

scratch는 **의존하는 공유 라이브러리가 없는 정적 바이너리**를 실행할 때만 쓸 수 있다. 가장 흔한 케이스는:

- **Go 바이너리** (`CGO_ENABLED=0`으로 빌드)
- **Rust 바이너리** (musl target으로 정적 링크)
- **C 바이너리** (완전 정적 링크: `-static` 플래그)

## Go 바이너리로 scratch 이미지 만들기

![scratch 기반 Go 바이너리 Dockerfile](/assets/posts/docker-scratch-image-build.svg)

```dockerfile
# Stage 1: 빌드
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# CGO 비활성화, 정적 링크, 디버그 심볼 제거
RUN CGO_ENABLED=0 GOOS=linux \
    go build -ldflags="-s -w" -o server .

# Stage 2: scratch 런타임
FROM scratch
# HTTPS 통신 필요 시 CA 인증서 복사
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
# 바이너리만 복사
COPY --from=builder /app/server /server
EXPOSE 8080
CMD ["/server"]
```

빌드 결과 확인:

```bash
$ docker build -t myapp:scratch .
$ docker image inspect myapp:scratch --format '{{.Size}}'
11534336  # 약 11MB (Go 바이너리 크기 그대로)

$ docker images myapp
REPOSITORY   TAG       IMAGE ID       SIZE
myapp        scratch   abc123         11MB
myapp        alpine    def456         28MB
myapp        debian    ghi789         84MB
```

## Rust 바이너리로 scratch 이미지 만들기

Rust는 musl 타겟으로 정적 링크 바이너리를 만들 수 있다.

```dockerfile
FROM rust:1.78-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY . .
RUN rustup target add x86_64-unknown-linux-musl
RUN cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder \
    /app/target/x86_64-unknown-linux-musl/release/myapp /myapp
CMD ["/myapp"]
```

## scratch 이미지에서 자주 필요한 파일들

scratch에는 아무 것도 없기 때문에 필요한 파일을 직접 복사해야 한다.

### CA 인증서 (HTTPS 통신)

```dockerfile
# builder 이미지에서 복사
COPY --from=builder /etc/ssl/certs/ca-certificates.crt \
     /etc/ssl/certs/ca-certificates.crt
```

Alpine builder를 쓰는 경우 먼저 `apk add --no-cache ca-certificates`를 실행해야 파일이 생긴다.

### 시간대 정보 (로컬 시간 필요 시)

```dockerfile
# tzdata에서 원하는 시간대만 복사
COPY --from=builder /usr/share/zoneinfo/Asia/Seoul \
     /usr/share/zoneinfo/Asia/Seoul
ENV TZ=Asia/Seoul
```

### /etc/passwd (비루트 사용자 실행 시)

```dockerfile
# 런타임 UID/GID 확인을 위해 필요
COPY --from=builder /etc/passwd /etc/passwd
USER nobody
```

## scratch vs distroless/static 선택 기준

```text
scratch 선택 조건:
  ✓ 완전한 제어 필요 (어떤 파일이 들어가는지 명확히 알고 싶을 때)
  ✓ 이미지 크기를 최대한 줄여야 할 때
  ✓ HTTPS 통신 없는 내부 서비스

distroless/static 선택 조건:
  ✓ CA 인증서, 시간대 정보가 이미 포함되어 있어 편의성 우선
  ✓ :debug 태그로 디버깅 옵션 필요
  ✓ 보안 업데이트가 Google에 의해 자동으로 이미지에 반영됨
```

## 자주 발생하는 오류

### exec format error

```bash
$ docker run myapp:scratch
standard_init_linux.go:228: exec user process caused: exec format error
```

빌드 머신과 런타임 아키텍처가 다르거나, CGO가 활성화된 상태로 빌드했을 때 발생한다.

```bash
# 올바른 빌드 명령 확인
$ file /path/to/binary
/path/to/binary: ELF 64-bit LSB executable, x86-64, statically linked
#                                                      ^^^^^^^^^^^^^^^ 이게 있어야 scratch에서 실행 가능
```

### no such file or directory (바이너리 자체 실행 불가)

```bash
$ docker run myapp:scratch
/server: no such file or directory
```

실제로 파일이 없는 게 아니라 동적 링크 인터프리터(`/lib64/ld-linux-x86-64.so.2`)를 찾지 못하는 것이다. `ldd /path/to/binary`로 동적 링크 여부를 확인하고, `CGO_ENABLED=0`을 추가한다.

### docker exec 불가

```bash
$ docker exec -it myapp-container sh
OCI runtime exec failed: exec failed: unable to start container process:
exec: "sh": executable file not found in $PATH
```

scratch에는 셸이 없어 `docker exec`가 불가능하다. 디버깅이 필요하면 `distroless/static:debug`로 잠시 교체하거나, Kubernetes에서 ephemeral container를 사용한다.

---

**지난 글:** [Alpine 이미지 함정: musl libc와 패키지 누락 문제](/posts/docker-alpine-pitfalls/)

**다음 글:** [Docker Slim과 이미지 최적화 도구 활용법](/posts/docker-slim-tools/)

<br>
읽어주셔서 감사합니다. 😊
