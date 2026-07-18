---
title: "Docker -p (publish)와 EXPOSE의 차이: 포트 공개의 진실"
description: "-p 옵션과 Dockerfile EXPOSE 명령어가 실제로 하는 일, iptables DNAT 동작 방식, 보안 바인딩까지 완전 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "publish", "expose", "포트", "iptables", "바인딩"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-port-mapping/)에서 `-p` 옵션의 형식과 iptables DNAT 원리를 살펴봤다. 이번 글에서는 그와 혼동되기 쉬운 `EXPOSE` 명령어가 실제로 무엇을 하는지, 그리고 `-p`와 어떻게 다른지를 명확히 정리한다.

## EXPOSE는 포트를 공개하지 않는다

Dockerfile에 `EXPOSE 80`을 적으면 "이 이미지는 80번 포트를 사용한다"는 **메타데이터**가 이미지 레이어에 기록된다. 그게 전부다. 호스트 포트가 바인딩되지 않고, iptables 규칙도 생기지 않으며, 외부에서 접근할 수도 없다.

```dockerfile
FROM nginx
EXPOSE 80   # 문서화 목적
EXPOSE 443
EXPOSE 53/udp
```

`docker inspect` 로 이미지의 `ExposedPorts` 필드를 보면 EXPOSE 선언이 그대로 기록되어 있다. 컨테이너 오케스트레이터나 `docker run -P`(대문자)가 이 정보를 읽어 자동으로 포트를 매핑할 때 사용한다.

## -p vs EXPOSE 한눈에 비교

![publish vs expose 다이어그램](/assets/posts/docker-network-publish-vs-expose-diagram.svg)

| 항목 | `-p` (publish) | `EXPOSE` |
|------|---------------|---------|
| 위치 | `docker run` 런타임 옵션 | Dockerfile 빌드 타임 |
| 호스트 바인딩 | 실제 바인딩 발생 | 바인딩 없음 |
| iptables 규칙 | 생성됨 | 생성 안 됨 |
| 외부 접근 | 가능 | 불가 |
| 주목적 | 포트 노출 | 문서화 + `-P` 트리거 |

## -p 형식 완전 정리

`-p` 옵션은 여러 형식을 지원한다.

```bash
# 가장 기본 형식: 호스트포트:컨테이너포트
docker run -p 8080:80 nginx

# IP 지정: 로컬호스트에서만 접근 가능 (보안)
docker run -p 127.0.0.1:8080:80 nginx

# 호스트포트 생략: 에페메랄 포트 자동 할당
docker run -p 80 nginx

# 프로토콜 지정
docker run -p 5353:53/udp dns-server

# 여러 포트 동시 바인딩
docker run -p 80:80 -p 443:443 nginx
```

호스트 IP를 `0.0.0.0`으로 바인딩하면(기본값) 모든 네트워크 인터페이스에서 접근할 수 있다. 내부 서비스라면 반드시 `127.0.0.1`로 제한해야 한다.

## -P (대문자): EXPOSE 전체 자동 매핑

```bash
# Dockerfile의 EXPOSE 선언을 모두 랜덤 포트로 바인딩
docker run -P nginx

# 할당된 포트 확인
docker port my-container
# 80/tcp -> 0.0.0.0:32768
# 443/tcp -> 0.0.0.0:32769
```

`-P`는 개발 환경에서 충돌 없이 빠르게 테스트할 때 유용하다. 프로덕션에서는 포트를 명시적으로 지정하는 `-p`를 쓴다.

## --expose 런타임 옵션

Dockerfile 없이 런타임에 EXPOSE 메타데이터를 추가하는 옵션이다.

```bash
# 컨테이너 실행 시 메타데이터만 추가 (바인딩 아님)
docker run --expose 8080 my-image

# 같은 네트워크 컨테이너끼리는 포트번호로 직접 통신 가능
# 호스트 외부에서는 여전히 접근 불가
```

사용 빈도는 낮지만, 같은 사용자 정의 네트워크에 있는 컨테이너들이 "이 컨테이너는 8080을 쓴다"는 것을 알 수 있게 문서화할 때 쓴다.

## 사용 패턴 정리

![publish expose 커맨드 패턴](/assets/posts/docker-network-publish-vs-expose-commands.svg)

### 보안 바인딩 패턴

외부 공개 불필요한 서비스는 `127.0.0.1`로 바인딩한다.

```bash
# DB는 로컬호스트에서만 접근
docker run -p 127.0.0.1:5432:5432 postgres

# 확인: 호스트 바인딩 주소
docker port db-container
# 5432/tcp -> 127.0.0.1:5432
```

### 포트 충돌 확인

같은 호스트 포트는 두 컨테이너가 동시에 바인딩할 수 없다.

```bash
# 8080 이미 사용 중인지 확인
ss -tlnp | grep :8080

# 또는 Docker가 사용 중인 포트 전체 확인
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

## 정리

- `EXPOSE`는 Dockerfile의 문서화 명령어다. 포트를 실제로 열지 않는다.
- `-p`는 런타임에 호스트 포트를 컨테이너 포트에 바인딩해 외부 트래픽을 연결한다.
- `-P`(대문자)는 이미지의 EXPOSE 선언을 읽어 전체를 랜덤 포트로 자동 매핑한다.
- 내부 서비스는 `127.0.0.1:포트:포트` 형식으로 바인딩 범위를 제한한다.

---

**지난 글:** [Docker 포트 매핑 완전 정복: -p와 --expose](/posts/docker-network-port-mapping/)

**다음 글:** [Docker 네트워크 격리: 컨테이너 간 통신 제어](/posts/docker-network-isolation/)

<br>
읽어주셔서 감사합니다. 😊
