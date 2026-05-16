---
title: "docker network create: 사용자 정의 네트워크 만들기"
description: "docker network create 명령어의 모든 옵션을 --subnet, --internal, --opt 등 실전 예제와 함께 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "create", "subnet", "internal", "브리지", "네트워크생성"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-macvlan/)에서 물리 네트워크에 직접 연결하는 macvlan을 다뤘다. 이번에는 실무에서 가장 자주 쓰이는 작업인 **`docker network create`로 사용자 정의 네트워크를 만드는 방법**을 상세히 정리한다.

## 기본 사용법

```bash
# 가장 단순한 형태 — 이름만 지정 (bridge 드라이버 기본값)
docker network create my-net

# 네트워크 확인
docker network ls
docker network inspect my-net
```

옵션을 지정하지 않으면 bridge 드라이버로 자동으로 서브넷이 할당된다. 대부분의 경우에는 이것으로 충분하지만, 실무에서는 여러 옵션을 조합해 정밀하게 제어한다.

## 주요 옵션 전체 정리

![docker network create 주요 옵션](/assets/posts/docker-network-create-options.svg)

### 서브넷 / IP 범위 제어

```bash
docker network create \
  --subnet 172.20.0.0/16 \
  --ip-range 172.20.10.0/24 \
  --gateway 172.20.0.1 \
  custom-net

# 특정 컨테이너에 고정 IP 할당
docker run --network custom-net --ip 172.20.10.100 nginx
```

`--subnet`으로 전체 범위를, `--ip-range`로 Docker가 자동 할당하는 범위를 제한할 수 있다. 수동 고정 IP는 `--ip-range` 밖의 주소를 사용하면 충돌을 피할 수 있다.

### --internal: 외부 차단 내부 전용 네트워크

![내부 전용 네트워크 구성](/assets/posts/docker-network-create-internal.svg)

```bash
# 외부 통신이 차단된 내부 네트워크
docker network create --internal backend-net

# DB는 backend-net에만 연결
docker run -d --network backend-net --name db postgres

# API는 두 네트워크 모두 연결
docker run -d --name api myapp
docker network connect backend-net api
docker network connect public-net api
```

`--internal` 네트워크는 인터넷으로 나가는 트래픽이 차단된다. DB, Redis, 내부 마이크로서비스처럼 외부에 노출되면 안 되는 서비스를 격리할 때 유용하다.

### --opt: 드라이버별 추가 옵션

```bash
# bridge 드라이버 전용 옵션
docker network create \
  --driver bridge \
  --opt com.docker.network.bridge.name=my-bridge0 \
  --opt com.docker.network.bridge.enable_ip_masquerade=true \
  --opt com.docker.network.bridge.enable_icc=false \
  --opt com.docker.network.driver.mtu=1450 \
  restricted-net
```

| 옵션 키 | 설명 |
|---|---|
| `bridge.name` | 호스트에서 보이는 브리지 인터페이스 이름 |
| `bridge.enable_ip_masquerade` | 외부 NAT 활성화 여부 |
| `bridge.enable_icc` | 컨테이너 간 통신 허용 여부 |
| `driver.mtu` | MTU 크기 (VPN, overlay 환경에서 조정 필요) |

### --attachable: Swarm 서비스와 단독 컨테이너 혼용

```bash
docker network create \
  --driver overlay \
  --attachable \
  shared-overlay

# Swarm 서비스
docker service create --network shared-overlay --name svc1 nginx

# 단독 컨테이너도 연결 가능
docker run --network shared-overlay --name tool alpine sh
```

overlay 네트워크 기본값에서는 Swarm 서비스만 연결할 수 있다. `--attachable`을 붙이면 `docker run`으로 실행한 일반 컨테이너도 해당 overlay 네트워크에 참여할 수 있다.

## 실전 패턴: 멀티티어 아키텍처

```bash
# 세 계층 네트워크 분리
docker network create frontend-net
docker network create --internal backend-net
docker network create --internal data-net

# Nginx: frontend-net에만
docker run -d --network frontend-net --name nginx nginx

# API: frontend-net + backend-net
docker run -d --name api myapp
docker network connect frontend-net api
docker network connect backend-net api

# DB: data-net에만
docker run -d --network data-net --name db postgres

# Worker: backend-net + data-net
docker run -d --name worker myworker
docker network connect backend-net worker
docker network connect data-net worker
```

## 네트워크 삭제

```bash
# 특정 네트워크 삭제 (연결된 컨테이너 없을 때만 가능)
docker network rm custom-net

# 미사용 네트워크 전체 삭제
docker network prune

# 레이블 필터로 선택 삭제
docker network prune --filter "label=env=dev"
```

---

**지난 글:** [Docker macvlan 네트워크: 물리 네트워크 직접 연결](/posts/docker-network-macvlan/)

**다음 글:** [docker network inspect: 네트워크 상태 분석](/posts/docker-network-inspect/)

<br>
읽어주셔서 감사합니다. 😊
