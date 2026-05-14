---
title: "tmpfs 마운트: 메모리 기반 임시 파일 시스템"
description: "Docker tmpfs 마운트의 동작 원리, --tmpfs와 --mount type=tmpfs 문법, size/noexec/nosuid 옵션, 보안 민감 데이터 임시 저장 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "tmpfs", "메모리 파일시스템", "보안", "volume"]
featured: false
draft: false
---

[지난 글](/posts/docker-bind-mount/)에서 Bind Mount로 호스트 파일시스템을 컨테이너에 연결하는 방법을 살펴봤다. 이번에는 **tmpfs 마운트**를 다룬다. 디스크가 아닌 호스트 메모리에만 존재하는 파일 시스템으로, 컨테이너가 종료되면 데이터가 완전히 사라진다.

## tmpfs란

tmpfs(temporary file system)는 Linux 커널이 제공하는 메모리 기반 파일 시스템이다. Docker는 이를 컨테이너에 마운트할 수 있도록 지원한다.

핵심 특성:
- **디스크에 아무것도 기록하지 않는다** — 포렌식이나 로그에 흔적 없음
- **컨테이너 종료 시 데이터 완전 소멸** — 다음 실행 시 항상 빈 상태
- **메모리 속도로 읽기/쓰기** — 디스크 I/O 없이 매우 빠름
- **Linux 호스트에서만 사용 가능** — Docker Desktop(Windows/Mac)은 지원 안 함

![tmpfs: 메모리 기반 파일시스템](/assets/posts/docker-tmpfs-concept.svg)

## 마운트 방법

![tmpfs 마운트 문법과 옵션](/assets/posts/docker-tmpfs-usecases.svg)

### `--tmpfs` 플래그 (단순)

```bash
# 기본 tmpfs 마운트
docker run --tmpfs /run my-app

# 옵션 지정 (경로:옵션 형식)
docker run \
  --tmpfs /run:rw,noexec,nosuid,size=64m \
  my-app
```

### `--mount type=tmpfs` (명시적)

```bash
docker run --mount \
  type=tmpfs,\
  target=/run,\
  tmpfs-size=67108864,\
  tmpfs-mode=1770 \
  my-app
```

`--mount` 방식에서 옵션 키:
- `tmpfs-size`: 최대 크기 (바이트 단위)
- `tmpfs-mode`: 권한 (8진수 형식)

## 주요 마운트 옵션

| 옵션 | 설명 |
|------|------|
| `size=64m` | tmpfs 최대 크기 제한 (기본값: 호스트 메모리의 50%) |
| `noexec` | 이 파일시스템에서 실행 파일 실행 금지 |
| `nosuid` | setuid/setgid 비트 무시 |
| `ro` | 읽기 전용 마운트 |
| `rw` | 읽기/쓰기 (기본값) |

보안을 위해 민감 데이터를 담는 tmpfs에는 `noexec,nosuid`를 추가하는 것이 좋다.

## 보안 민감 데이터 저장 패턴

tmpfs의 가장 중요한 용도는 세션 토큰, 임시 인증서, 암호화 키 같은 민감 데이터를 메모리에만 보관하는 것이다.

```bash
# 세션 토큰을 tmpfs에 쓰는 예시
docker run \
  --tmpfs /run/secrets:rw,noexec,nosuid,size=1m \
  --env SESSION_SECRET_PATH=/run/secrets/token \
  my-app
```

tmpfs에 쓴 데이터는:
- 디스크에 기록되지 않으므로 `docker cp`로 복사 불가
- 컨테이너 종료 후 복구 불가
- `docker exec cat /run/secrets/token`으로 접근하려면 컨테이너가 실행 중이어야 함

## 소켓·PID 파일 용도

런타임 소켓이나 PID 파일처럼 재시작마다 새로 생성해야 하는 파일을 tmpfs에 두면 깔끔하다.

```bash
# nginx pid 파일을 tmpfs에
docker run \
  --tmpfs /var/run:rw,noexec,nosuid \
  nginx
```

## Compose에서 tmpfs

```yaml
services:
  app:
    image: my-app
    tmpfs:
      - /run
      - /tmp:size=64m,mode=1777
```

또는 `volumes` 섹션에서:

```yaml
services:
  app:
    image: my-app
    volumes:
      - type: tmpfs
        target: /run
        tmpfs:
          size: 67108864
```

## tmpfs vs Named Volume vs Bind Mount

| 항목 | tmpfs | Named Volume | Bind Mount |
|------|-------|-------------|------------|
| 저장 위치 | 메모리 | 호스트 디스크 | 호스트 디스크 |
| 재시작 후 | 소멸 | 유지 | 유지 |
| 속도 | 매우 빠름 | 보통 | 보통 |
| 보안 | 디스크 흔적 없음 | 흔적 남음 | 흔적 남음 |
| Linux 전용 | 예 | 아니오 | 아니오 |

## 주의사항

- `size` 제한 없으면 메모리 고갈 가능 → 항상 `size` 옵션 지정 권장
- Docker Desktop(Mac/Windows)에서는 tmpfs가 지원되지 않는다
- `docker commit`으로 이미지를 만들어도 tmpfs 내용은 포함되지 않는다
- 컨테이너 재시작(`docker restart`)에서도 tmpfs 내용은 초기화된다

## 핵심 정리

- tmpfs는 메모리 기반, 디스크 기록 없음, 컨테이너 종료 시 소멸
- `--tmpfs /경로:옵션` 또는 `--mount type=tmpfs,target=/경로`로 마운트
- `size`, `noexec`, `nosuid` 옵션으로 보안 강화
- 세션 토큰, 임시 키, 소켓 파일 등 민감 임시 데이터에 적합
- Linux 호스트 전용 — Docker Desktop에서는 미지원

---

**지난 글:** [Bind Mount 완전 정복: 호스트 디렉터리를 컨테이너에 마운트](/posts/docker-bind-mount/)

**다음 글:** [Docker 볼륨 드라이버: 외부 스토리지 연결하기](/posts/docker-volume-driver/)

<br>
읽어주셔서 감사합니다. 😊
