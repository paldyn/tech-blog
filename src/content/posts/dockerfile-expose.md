---
title: "EXPOSE 인스트럭션 완전 정복"
description: "Dockerfile EXPOSE 인스트럭션이 실제로 포트를 여는지 여부, 문서화 역할, -p와 -P 플래그와의 관계, UDP 포트 지정, Compose와의 연동 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "EXPOSE", "포트", "네트워크", "포트매핑"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-cmd-vs-entrypoint/)에서 컨테이너 시작 명령을 정의하는 CMD와 ENTRYPOINT를 살펴봤다. 이번에는 자주 오해받는 인스트럭션인 `EXPOSE`를 명확하게 정리한다.

## EXPOSE는 포트를 열지 않는다

가장 흔한 오해부터 짚고 넘어간다. **`EXPOSE`는 포트를 실제로 개방하지 않는다.** 호스트와 컨테이너 사이에 어떤 포트 바인딩도 만들지 않는다.

`EXPOSE`는 **문서화 인스트럭션**이다. 이 이미지로 실행한 컨테이너가 어떤 포트를 리슨하는지 알려주는 메타데이터 역할을 한다.

![EXPOSE — 문서화 vs 실제 바인딩](/assets/posts/dockerfile-expose-overview.svg)

```dockerfile
# 이 줄은 포트를 열지 않는다
EXPOSE 3000
```

실제로 호스트에서 컨테이너 포트에 접근하려면 `docker run -p` 또는 Compose `ports:` 설정이 필요하다.

## 문법

![EXPOSE 문법과 -P 플래그](/assets/posts/dockerfile-expose-code.svg)

```dockerfile
# TCP (기본)
EXPOSE 80
EXPOSE 3000 8080

# UDP
EXPOSE 53/udp
EXPOSE 5353/udp

# TCP + UDP 모두
EXPOSE 5000/tcp
EXPOSE 5000/udp
```

프로토콜을 생략하면 TCP로 처리된다. 여러 포트를 한 줄에 공백으로 나열하거나 여러 `EXPOSE`를 작성해도 된다.

## 실제 포트 개방: -p와 -P

```bash
# -p: 특정 포트 명시적 바인딩
# 호스트 8080 → 컨테이너 3000
docker run -p 8080:3000 myapp

# -p: 컨테이너 포트만 지정 (호스트 포트 임의 배정)
docker run -p 3000 myapp

# -P: EXPOSE된 모든 포트를 임의 호스트 포트에 자동 매핑
docker run -P myapp

# 매핑 확인
docker port myapp
```

`-P` 플래그가 `EXPOSE`를 직접 참고한다. `EXPOSE`에 명시한 포트들이 임의의 에피메랄 포트(49000번대)에 자동으로 매핑된다. 개발 환경에서 여러 컨테이너를 동시에 띄울 때 포트 충돌 없이 편리하게 사용할 수 있다.

## Docker Compose에서

```yaml
services:
  app:
    build: .
    ports:
      - "8080:3000"   # 실제 바인딩
    # expose:           # 호스트 바인딩 없이 같은 네트워크 컨테이너에만 공개
    #   - "3000"
```

Compose의 `expose:` 키는 Dockerfile `EXPOSE`와 같다 — 같은 Docker 네트워크의 다른 컨테이너에서는 접근 가능하지만 호스트에서는 접근 불가다. `ports:`만이 실제로 호스트 포트를 바인딩한다.

## 같은 네트워크 컨테이너 간 통신

```bash
# 사용자 정의 네트워크 생성
docker network create mynet

# EXPOSE 3000을 가진 app 컨테이너 실행 (-p 없이)
docker run --network mynet --name app myapp

# 같은 네트워크의 다른 컨테이너에서 접근 가능
docker run --network mynet curlimage curl http://app:3000
```

같은 Docker 네트워크에 속한 컨테이너끼리는 `EXPOSE` 여부와 무관하게 컨테이너 이름으로 통신할 수 있다. `EXPOSE`는 이 동작에 영향을 주지 않는다.

## EXPOSE의 실질적 가치

`EXPOSE`가 포트를 열지 않는다면 왜 쓰는가?

1. **문서화**: 이미지 사용자가 `docker inspect`나 Dockerfile을 보고 어떤 포트를 사용해야 하는지 알 수 있다
2. **`-P` 플래그 연동**: 자동 포트 매핑 기능을 쓰려면 `EXPOSE`에 포트가 명시돼 있어야 한다
3. **도구 연동**: 일부 오케스트레이션 도구나 CI 파이프라인이 `EXPOSE` 메타데이터를 읽어 자동 설정한다

```bash
# docker inspect로 EXPOSE된 포트 확인
docker inspect --format='{{.Config.ExposedPorts}}' myimage
# map[3000/tcp:{}]
```

## 핵심 정리

- `EXPOSE`는 **포트를 열지 않는다** — 메타데이터(문서화)만 담는다
- 호스트 포트 바인딩은 `docker run -p 호스트:컨테이너` 또는 Compose `ports:`로 설정
- `docker run -P`는 `EXPOSE`에 명시된 포트를 임의 호스트 포트에 자동 매핑
- 프로토콜 기본값은 TCP; UDP는 `/udp` 명시 필요
- 같은 네트워크 컨테이너 간 통신은 `EXPOSE` 없이도 가능

---

**지난 글:** [CMD vs ENTRYPOINT: 컨테이너 시작 명령](/posts/dockerfile-cmd-vs-entrypoint/)

**다음 글:** [VOLUME 인스트럭션 완전 정복](/posts/dockerfile-volume/)

<br>
읽어주셔서 감사합니다. 😊
