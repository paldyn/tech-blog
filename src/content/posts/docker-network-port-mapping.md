---
title: "Docker 포트 매핑 완전 정복: -p와 --expose"
description: "docker run -p 옵션의 모든 형식, iptables DNAT 동작 원리, 보안 IP 바인딩, --expose와의 차이를 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "포트매핑", "iptables", "DNAT", "expose", "바인딩", "보안"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-dns/)에서 컨테이너 이름 DNS 해석 원리를 살펴봤다. 이번에는 외부에서 컨테이너로 트래픽을 전달하는 **포트 매핑**을 깊이 있게 다룬다.

## 포트 매핑이란

컨테이너는 자체 네트워크 네임스페이스 안에 있어 호스트 외부에서 직접 접근할 수 없다. `-p` 옵션으로 호스트의 포트와 컨테이너 포트를 연결해야 외부에서 접근할 수 있다.

```bash
# 기본 형식
docker run -d -p 8080:80 nginx
# 호스트:8080 → 컨테이너:80
```

## 동작 원리

![Docker 포트 매핑 동작 원리](/assets/posts/docker-network-port-mapping-diagram.svg)

포트 매핑은 내부적으로 **iptables DNAT 규칙**으로 구현된다. 호스트의 8080 포트로 들어오는 패킷을 컨테이너 IP의 80 포트로 재작성한다.

```bash
# Docker가 추가한 iptables 규칙 확인
sudo iptables -t nat -L DOCKER -n -v
# DNAT  tcp -- anywhere  anywhere
#   tcp dpt:8080 to:172.17.0.2:80

# docker-proxy 프로세스도 확인 가능 (보조 역할)
ps aux | grep docker-proxy
```

## -p 옵션 형식 전체

```bash
# 1. 호스트포트:컨테이너포트
docker run -p 8080:80 nginx

# 2. 특정 IP 바인딩 (보안)
docker run -p 127.0.0.1:8080:80 nginx

# 3. 임의 호스트 포트 자동 할당
docker run -p 80 nginx
# 어떤 포트가 할당됐는지 확인: docker port <container>

# 4. 포트 범위
docker run -p 8000-8010:8000-8010 myapp

# 5. UDP 포트
docker run -p 5353:53/udp dns-server

# 6. 여러 포트 동시 매핑
docker run -p 80:80 -p 443:443 nginx

# 7. 대문자 -P: EXPOSE된 포트 모두 자동 매핑
docker run -P nginx
```

## 보안: IP 바인딩

![포트 바인딩 보안](/assets/posts/docker-network-port-mapping-security.svg)

`-p 8080:80`은 `0.0.0.0:8080`에 바인딩되어 모든 네트워크 인터페이스에서 접근 가능하다. 이는 클라우드 방화벽 설정 실수 시 외부로 노출될 수 있다.

```bash
# 위험: 모든 인터페이스에 바인딩
docker run -p 5432:5432 postgres  # DB가 외부에 노출 가능!

# 안전: 로컬호스트에만 바인딩
docker run -p 127.0.0.1:5432:5432 postgres

# 특정 내부 IP에만 바인딩
docker run -p 10.0.0.1:5432:5432 postgres
```

DB, Redis, 내부 서비스 포트는 `127.0.0.1`로 바인딩하고, 외부 접근은 Nginx 같은 리버스 프록시를 통하는 것이 안전하다.

## 할당된 포트 확인

```bash
# 컨테이너의 포트 매핑 확인
docker port my-container
# 80/tcp -> 0.0.0.0:8080

# 특정 포트만 확인
docker port my-container 80
# 0.0.0.0:8080

# docker ps로도 확인
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

## EXPOSE와 -p의 차이

Dockerfile의 `EXPOSE`와 `-p`는 전혀 다른 역할이다.

| 구분 | 역할 | 실제 포트 개방 |
|---|---|---|
| `EXPOSE 80` | 문서화 / 메타데이터 | ✗ 개방 안 됨 |
| `-p 8080:80` | 실제 포트 매핑 | ✓ 개방됨 |
| `-P` | EXPOSE된 포트 모두 자동 매핑 | ✓ 개방됨 |

```dockerfile
# Dockerfile
EXPOSE 80 443
# 이것만으로는 외부에서 접근 불가
```

`EXPOSE`는 "이 이미지는 80 포트를 쓴다"는 선언적 문서다. 실제로 포트를 열려면 반드시 `-p`가 필요하다. `docker run -P`는 `EXPOSE`된 포트들을 임의 호스트 포트로 자동 매핑하는 단축키다.

## Compose에서 포트 매핑

```yaml
services:
  web:
    image: nginx
    ports:
      - "8080:80"              # 기본
      - "127.0.0.1:443:443"   # IP 바인딩
      - "5353:53/udp"          # UDP
      - "8000-8010:8000-8010"  # 범위

  db:
    image: postgres
    # 포트를 열지 않음 → 같은 네트워크 내에서만 접근
    expose:
      - "5432"    # 다른 서비스에서 접근 가능 (외부는 불가)
```

Compose의 `expose`는 Dockerfile의 `EXPOSE`와 같다 — 같은 Compose 네트워크 내에서는 접근 가능하지만, 호스트 포트 매핑은 없다.

## 실전 패턴: 리버스 프록시 구성

```yaml
services:
  nginx:
    image: nginx
    ports:
      - "80:80"
      - "443:443"
    # 외부는 nginx만 노출

  api:
    image: myapi
    # 포트 매핑 없음 — nginx를 통해서만 접근
    expose:
      - "8080"

  db:
    image: postgres
    # 포트 매핑 없음 — api에서만 접근
```

---

**지난 글:** [Docker 네트워크 DNS: 컨테이너 이름 해석 원리](/posts/docker-network-dns/)

**다음 글:** [Docker -p (publish)와 EXPOSE의 차이: 포트 공개의 진실](/posts/docker-network-publish-vs-expose/)

<br>
읽어주셔서 감사합니다. 😊
