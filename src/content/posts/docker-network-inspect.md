---
title: "docker network inspect: 네트워크 상태 분석"
description: "docker network inspect 명령어로 네트워크 설정, 연결된 컨테이너, IP 정보를 확인하고 --format 템플릿으로 원하는 필드만 추출하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "inspect", "format", "디버깅", "컨테이너", "IP"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-create/)에서 사용자 정의 네트워크를 만드는 방법을 다뤘다. 이번에는 이미 존재하는 네트워크의 상태를 분석하는 **`docker network inspect`** 명령어를 자세히 살펴본다.

## 기본 사용법

```bash
# 네트워크 이름 또는 ID로 조회
docker network inspect my-net

# 여러 네트워크 한꺼번에 조회
docker network inspect bridge host none

# 네트워크 목록 확인 후 inspect
docker network ls
docker network inspect $(docker network ls -q)
```

기본 출력은 JSON 형식이다. 상당히 많은 정보가 포함되어 있으므로, 실무에서는 `--format`을 활용해 필요한 부분만 추출한다.

## 출력 구조 이해

![docker network inspect 출력 구조](/assets/posts/docker-network-inspect-output.svg)

주요 최상위 필드:

| 필드 | 설명 |
|---|---|
| `Name` | 네트워크 이름 |
| `Id` | 64자리 해시 ID |
| `Driver` | 드라이버 종류 |
| `Scope` | local / swarm / global |
| `Internal` | 외부 통신 차단 여부 |
| `IPAM.Config` | 서브넷, 게이트웨이, IP 범위 |
| `Containers` | 현재 연결된 컨테이너 목록 |
| `Options` | 드라이버별 옵션 |
| `Labels` | 사용자 정의 레이블 |

## --format으로 원하는 정보 추출

![--format 템플릿 활용](/assets/posts/docker-network-inspect-format.svg)

Go 템플릿 문법을 사용해 JSON 출력을 필터링한다.

```bash
# 서브넷 확인
docker network inspect my-net \
  --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
# 172.20.0.0/16

# 게이트웨이 확인
docker network inspect my-net \
  --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
# 172.20.0.1

# 드라이버와 internal 여부
docker network inspect my-net \
  --format '{{.Driver}} / internal={{.Internal}}'
# bridge / internal=false
```

### 연결된 컨테이너 목록

```bash
# 컨테이너 이름과 IP 한 줄씩 출력
docker network inspect my-net \
  --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}'
# web  172.20.0.2/16
# api  172.20.0.3/16
# db   172.20.0.4/16

# 컨테이너 수만 확인
docker network inspect my-net \
  --format '{{len .Containers}} containers'
```

## 컨테이너의 네트워크 정보 확인

네트워크 쪽이 아닌 컨테이너 쪽에서도 네트워크 정보를 볼 수 있다.

```bash
# 컨테이너의 네트워크 설정 전체
docker inspect web --format '{{json .NetworkSettings}}'

# 특정 네트워크의 IP만
docker inspect web \
  --format '{{.NetworkSettings.Networks.my-net.IPAddress}}'
# 172.20.0.2

# 연결된 모든 네트워크와 IP
docker inspect web \
  --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}:{{$v.IPAddress}}{{"\n"}}{{end}}'
```

## overlay 네트워크 peer 확인

```bash
# Swarm overlay 네트워크에서 참여 호스트 확인
docker network inspect my-overlay \
  --format '{{range .Peers}}{{.Name}} {{.IP}}{{"\n"}}{{end}}'
```

## 실전 디버깅 패턴

```bash
# 특정 IP를 가진 컨테이너 찾기 (스크립트 활용)
for net in $(docker network ls -q); do
  docker network inspect "$net" \
    --format "{{range .Containers}}$net {{.Name}} {{.IPv4Address}}{{\"\\n\"}}{{end}}"
done | grep "172.20.0.5"

# 네트워크의 브리지 인터페이스 이름 확인
docker network inspect bridge \
  --format '{{index .Options "com.docker.network.bridge.name"}}'
# docker0
```

## jq와 함께 사용

JSON 출력을 jq로 파이핑하면 더 강력하게 처리할 수 있다.

```bash
# 연결된 컨테이너의 IP만 배열로
docker network inspect my-net | \
  jq '.[0].Containers | to_entries[] | {name: .value.Name, ip: .value.IPv4Address}'

# 네트워크 목록을 이름·드라이버·서브넷 테이블로
docker network ls -q | xargs docker network inspect | \
  jq -r '.[] | [.Name, .Driver, (.IPAM.Config[0].Subnet // "N/A")] | @tsv'
```

---

**지난 글:** [docker network create: 사용자 정의 네트워크 만들기](/posts/docker-network-create/)

**다음 글:** [Docker 네트워크 DNS: 컨테이너 이름 해석 원리](/posts/docker-network-dns/)

<br>
읽어주셔서 감사합니다. 😊
