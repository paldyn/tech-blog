---
title: "컨테이너 네트워크 연결 문제 디버깅"
description: "Docker 컨테이너 간 통신 실패, 포트 바인딩 오류, iptables 규칙 문제를 ping·curl·ss·tcpdump를 사용해 단계별로 진단하고 수정하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "debugging", "ping", "curl", "iptables", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/docker-debug-permissions/)에서 컨테이너 권한 오류를 다뤘다. 이번 편은 "컨테이너끼리 통신이 안 된다", "외부에서 접근이 안 된다"는 유형의 네트워크 연결 문제를 체계적으로 진단하는 방법을 다룬다.

## 디버깅 도구 선택

![컨테이너 네트워크 디버깅 도구](/assets/posts/docker-debug-networking-tools.svg)

네트워크 문제는 계층별로 접근해야 빠르게 원인을 찾을 수 있다.

| 계층 | 도구 | 확인 내용 |
|---|---|---|
| 연결성 | `ping`, `curl`, `nc` | IP 도달 가능, HTTP 응답 |
| 소켓/포트 | `ss`, `netstat` | 포트가 실제로 리스닝 중인지 |
| 패킷 | `tcpdump` | 패킷이 도달하는지, 어디서 막히는지 |
| 라우팅 | `ip route`, `iptables` | 경로, 방화벽 규칙 |

## 단계별 진단 흐름

![네트워크 문제 진단 흐름도](/assets/posts/docker-debug-networking-flow.svg)

### 1단계: 컨테이너 실행 여부

```bash
docker ps -a --filter name=myapp

# 종료된 컨테이너라면 로그로 원인 확인
docker logs myapp --tail 50
```

### 2단계: 같은 네트워크에 있는지 확인

컨테이너 이름으로 통신하려면 반드시 같은 user-defined 네트워크에 있어야 한다. 기본 bridge 네트워크는 이름 해석을 지원하지 않는다.

```bash
# 네트워크 멤버 확인
docker network inspect mynet --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{"\n"}}{{end}}'

# 컨테이너가 어느 네트워크에 연결됐는지
docker inspect myapp --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}: {{$v.IPAddress}}{{"\n"}}{{end}}'

# 연결 추가
docker network connect mynet myapp
```

### 3단계: 3계층(IP) 연결 확인

```bash
# 컨테이너 간 ping (이름으로)
docker exec app ping -c 3 db

# IP로 직접 ping
docker exec app ping -c 3 172.18.0.3

# ping이 없는 이미지는 nc로
docker exec app nc -zv db 5432
```

### 4단계: 포트 리스닝 확인

`curl` 연결 실패의 가장 흔한 원인은 앱이 `127.0.0.1`(localhost)에만 바인딩했기 때문이다. 컨테이너 내부에서는 `0.0.0.0`에 바인딩해야 외부에서 접근할 수 있다.

```bash
# 대상 컨테이너에서 리스닝 포트 확인
docker exec db ss -tlnp
# State    Recv-Q   Local Address:Port
# LISTEN   0        0.0.0.0:5432      ← 0.0.0.0이어야 외부 접근 가능
# LISTEN   0        127.0.0.1:5432    ← localhost만 → 다른 컨테이너에서 접근 불가

# HTTP 응답 직접 확인
docker exec app curl -v http://api:8080/health
```

## iptables / 라우팅 확인 (호스트)

```bash
# Docker가 설정한 NAT 규칙 확인
sudo iptables -t nat -L DOCKER -n -v

# FORWARD 체인 규칙 확인
sudo iptables -L FORWARD -n -v

# 라우팅 테이블
ip route show

# 컨테이너 네트워크 인터페이스 목록
ip link show | grep veth
```

## 네트워크 없는 이미지에서 디버깅: netshoot 사용

`ping`, `curl`, `ss` 가 없는 minimal 이미지에서는 `nicolaka/netshoot`을 같은 네트워크로 붙여 진단한다.

```bash
# 같은 네트워크 네임스페이스로 진입
docker run -it --rm \
  --net container:myapp \
  nicolaka/netshoot \
  ss -tlnp

# 또는 같은 docker 네트워크에 붙여서 이름 해석 테스트
docker run -it --rm \
  --network mynet \
  nicolaka/netshoot \
  nslookup myapp
```

## 호스트↔컨테이너 포트 바인딩 문제

```bash
# 포트 바인딩 확인
docker port myapp

# 호스트에서 접근 테스트
curl http://localhost:8080

# 호스트에서 실제로 리스닝 중인지 확인
ss -tlnp | grep 8080

# 포트가 이미 사용 중인지 확인
sudo lsof -i :8080
```

publish(`-p`) 없이 `EXPOSE`만 했다면 호스트에서 접근할 수 없다. `EXPOSE`는 문서화일 뿐 실제 포트를 열지 않는다.

```bash
# 실행 중 포트 추가는 불가, 컨테이너 재생성 필요
docker run -p 8080:8080 myapp

# compose.yml
services:
  app:
    image: myapp
    ports:
      - "8080:8080"
```

---

**지난 글:** [컨테이너 권한 오류 디버깅: Permission denied 완벽 해결](/posts/docker-debug-permissions/)

**다음 글:** [컨테이너 DNS 문제 진단과 수정](/posts/docker-debug-dns/)

<br>
읽어주셔서 감사합니다. 😊
