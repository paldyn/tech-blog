---
title: "Docker 네트워크 완전 정복: 드라이버 종류와 동작 원리"
description: "Docker 네트워크의 전체 구조와 bridge, host, none, overlay, macvlan 드라이버의 동작 원리를 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "bridge", "overlay", "macvlan", "네트워크", "드라이버"]
featured: false
draft: false
---

[지난 글](/posts/docker-volume-pitfalls/)에서 볼륨 관련 실전 함정들을 다뤘다. 이번 장부터는 Docker의 또 다른 핵심 축인 **네트워크**를 집중적으로 파고든다. 컨테이너끼리, 혹은 외부 세계와 어떻게 통신하는지 이해하지 못하면 멀티 컨테이너 애플리케이션 운영에서 반드시 막힌다.

## Docker 네트워크란

컨테이너는 독립된 네트워크 네임스페이스를 갖는다. 즉, 기본 상태에서 서로 다른 컨테이너는 호스트 네트워크나 다른 컨테이너에 직접 접근할 수 없다. Docker는 **네트워크 드라이버** 를 통해 이 격리된 네트워크 네임스페이스들을 서로 연결하거나, 외부와 이어주는 역할을 한다.

Docker를 설치하면 기본적으로 세 개의 네트워크가 자동 생성된다.

```bash
docker network ls
# NETWORK ID     NAME      DRIVER    SCOPE
# 3b8ef7c1a2b3   bridge    bridge    local
# 8d9fa2b1c0e4   host      host      local
# 1a2b3c4d5e6f   none      null      local
```

`bridge`(기본 브리지), `host`(호스트 네트워크), `none`(격리) — 이 세 네트워크는 삭제할 수 없으며 Docker가 항상 관리한다.

## 드라이버 종류 한눈에 보기

![Docker 네트워크 드라이버 종류](/assets/posts/docker-network-overview-types.svg)

각 드라이버는 목적이 뚜렷이 다르다.

| 드라이버 | 격리 수준 | 범위 | 주 사용처 |
|---|---|---|---|
| bridge | 중간 | 단일 호스트 | 기본 개발/운영 |
| host | 없음 | 단일 호스트 | 성능 극한 |
| none | 완전 | 단일 호스트 | 보안 격리 |
| overlay | 중간 | 멀티 호스트 | Swarm/클러스터 |
| macvlan | 낮음 | 단일 호스트 | 물리 네트워크 직접 연결 |
| ipvlan | 낮음 | 단일 호스트 | macvlan 대안 |

## 각 드라이버 개요

### bridge — 기본 드라이버

가장 흔히 사용하는 드라이버다. Docker는 호스트에 `docker0`이라는 가상 브리지를 만들고, 같은 브리지 네트워크에 속한 컨테이너들을 `veth pair`로 연결한다. 컨테이너는 브리지를 통해 다른 컨테이너나 외부 인터넷에 나갈 수 있다.

단, 기본 `bridge` 네트워크는 DNS 기반 컨테이너 이름 해석이 안 된다. **사용자 정의 브리지 네트워크를 만들어야** 컨테이너 이름으로 서로를 찾을 수 있다.

### host — 호스트 네트워크 공유

컨테이너가 호스트의 네트워크 스택을 그대로 사용한다. NAT 오버헤드가 없어 성능이 가장 좋지만 격리가 없다. Linux 전용이며, macOS·Windows의 Docker Desktop에서는 동작이 다르다.

### none — 완전 격리

루프백 인터페이스(`lo`)만 존재하고 외부와 일절 통신하지 않는다. 보안 처리가 필요한 일회성 컨테이너나, 직접 커스텀 네트워크 플러그인을 붙이는 경우에 사용한다.

### overlay — 멀티 호스트 네트워크

Docker Swarm 환경에서 여러 호스트의 컨테이너를 마치 하나의 네트워크에 있는 것처럼 연결한다. VXLAN 터널링으로 호스트 간 트래픽을 캡슐화한다.

### macvlan — 실제 MAC 주소 할당

컨테이너에 고유한 MAC 주소를 부여해 물리 네트워크에 직접 연결된 장치처럼 동작하게 한다. DHCP 서버가 컨테이너에 직접 IP를 줄 수도 있다. 레거시 애플리케이션을 컨테이너로 마이그레이션할 때 유용하다.

## 기본 명령어

![Docker 네트워크 기본 명령어](/assets/posts/docker-network-overview-commands.svg)

```bash
# 네트워크 생성 (브리지 드라이버, 기본값)
docker network create my-net

# 컨테이너 실행 시 네트워크 지정
docker run -d --network my-net --name web nginx

# 실행 중인 컨테이너를 네트워크에 연결
docker network connect my-net existing-container

# 연결 해제
docker network disconnect my-net existing-container

# 미사용 네트워크 정리
docker network prune
```

## 사용자 정의 네트워크를 써야 하는 이유

기본 `bridge` 네트워크 대신 직접 만든 네트워크를 써야 하는 이유는 세 가지다.

1. **DNS 자동 등록**: 같은 네트워크 내에서 컨테이너 이름으로 바로 통신 가능
2. **격리 범위 제어**: 서로 다른 앱 스택을 분리된 네트워크에 배치
3. **동적 연결·해제**: 실행 중인 컨테이너를 네트워크에 붙이고 뗄 수 있음

```bash
# 두 컨테이너가 같은 사용자 정의 네트워크에 있으면
# 컨테이너 이름으로 바로 통신 가능
docker network create app-net
docker run -d --network app-net --name db postgres
docker run -d --network app-net --name api myapp
# api 컨테이너 안에서: ping db  -> 정상 동작
```

기본 `bridge`에서는 이 DNS 해석이 되지 않아 IP를 직접 써야 한다. 컨테이너 IP는 재시작할 때마다 바뀔 수 있으므로 사용자 정의 네트워크 사용이 사실상 필수다.

## Compose와의 관계

Docker Compose는 `docker-compose.yml`에 정의된 서비스들을 위한 **전용 브리지 네트워크를 자동으로 생성**한다. 서비스 이름이 곧 DNS 이름이 되어, `db`, `redis` 같은 이름으로 바로 통신할 수 있다. 이것도 내부적으로는 사용자 정의 브리지 네트워크를 사용하는 것이다.

---

**지난 글:** [Docker 볼륨 함정과 해결책: 자주 만나는 문제들](/posts/docker-volume-pitfalls/)

**다음 글:** [Docker bridge 네트워크 완전 분석](/posts/docker-network-bridge/)

<br>
읽어주셔서 감사합니다. 😊
