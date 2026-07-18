---
title: "Docker 네트워크 트러블슈팅: 연결 안 될 때 진단 가이드"
description: "컨테이너 간 통신 실패 시 단계별 진단 방법, DNS 오류, 포트 접근 불가, iptables 확인까지 실전 트러블슈팅을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "트러블슈팅", "DNS", "iptables", "netshoot", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-isolation/)에서 네트워크 격리 원리를 살펴봤다. 이번에는 컨테이너 간 통신이 안 될 때 어떤 순서로 진단할지 실전 가이드를 정리한다.

## 트러블슈팅 흐름

![트러블슈팅 흐름도](/assets/posts/docker-network-troubleshoot-diagram.svg)

네트워크 문제는 대부분 다음 세 가지 중 하나다.

1. **컨테이너가 같은 네트워크에 없다** — DNS 조회 실패
2. **포트가 열려 있지 않다** — 연결 거부(ECONNREFUSED)
3. **iptables 규칙이 차단한다** — 패킷 드롭

## 1단계: 컨테이너 상태 확인

```bash
# 컨테이너 실행 중인지, 재시작 루프인지 확인
docker ps -a

# 컨테이너가 속한 네트워크와 IP 확인
docker inspect web --format '{{range .NetworkSettings.Networks}}{{.NetworkID}} {{.IPAddress}}{{end}}'
```

컨테이너가 `Exited` 상태이면 네트워크 문제 전에 앱 자체가 죽은 것이다. `docker logs web`으로 앱 로그부터 확인한다.

## 2단계: 네트워크 소속 확인

```bash
# 두 컨테이너가 같은 네트워크에 있는지 확인
docker network inspect my-net

# 네트워크에 연결된 컨테이너 이름만 출력
docker network inspect my-net \
  --format '{{range .Containers}}{{.Name}} {{end}}'
```

`web`과 `db`가 서로 다른 네트워크에 있으면 DNS 조회 자체가 실패한다. 같은 사용자 정의 네트워크에 연결해야 한다.

## 3단계: DNS 해석 테스트

```bash
# web 컨테이너에서 db 컨테이너 이름 해석
docker exec web nslookup db

# ping으로 IP 레이어 확인
docker exec web ping -c 3 db

# 기본 bridge 네트워크에서는 DNS 안 됨
# 반드시 사용자 정의 네트워크 사용
```

DNS가 실패하면 네트워크 재연결이 필요하다.

```bash
docker network connect my-net web
docker network connect my-net db
```

## 4단계: 포트 접근 테스트

DNS가 되는데 접근이 안 된다면 앱이 포트를 정상적으로 리슨하지 않거나 방화벽 문제다.

```bash
# HTTP 응답 확인
docker exec web curl -v http://api:3000/health

# TCP 포트 연결 가능 여부 (curl 없는 이미지)
docker exec web nc -zv db 5432

# 컨테이너 내부 리슨 포트 확인
docker exec db ss -tlnp
```

## 5단계: nicolaka/netshoot 활용

진단 도구가 없는 최소 이미지(distroless, alpine 등)에서는 별도 netshoot 컨테이너를 같은 네트워크에 붙여 진단한다.

```bash
# web 컨테이너의 네트워크 네임스페이스를 공유하는 진단 컨테이너
docker run -it --rm \
  --network container:web \
  nicolaka/netshoot

# 또는 같은 네트워크에 독립 컨테이너로 실행
docker run -it --rm \
  --network my-net \
  nicolaka/netshoot
```

`netshoot`에는 `tcpdump`, `ss`, `ip`, `nslookup`, `curl`, `netstat` 등이 모두 포함되어 있다.

## 핵심 커맨드 모음

![진단 커맨드](/assets/posts/docker-network-troubleshoot-commands.svg)

## iptables 확인 (고급)

컨테이너 레이어에서 다 정상인데 여전히 패킷이 안 가면 호스트 iptables를 확인한다.

```bash
# DOCKER 체인 확인
sudo iptables -L DOCKER -n --line-numbers

# NAT 포워딩 규칙
sudo iptables -t nat -L DOCKER -n

# FORWARD 체인에서 브리지 간 차단 여부
sudo iptables -L FORWARD -n --line-numbers
```

`--iptables=false`로 Docker 데몬을 시작했거나, 보안 소프트웨어가 FORWARD를 DROP으로 바꾼 경우 모든 컨테이너 통신이 끊긴다.

## 자주 나타나는 증상과 원인

| 증상 | 원인 | 해결 |
|------|------|------|
| `ping: bad address 'db'` | DNS 실패 — 다른 네트워크 | 같은 네트워크로 연결 |
| `Connection refused` | 앱이 해당 포트 미리슨 | 앱 로그 확인, 바인딩 주소 확인 |
| `Connection timed out` | iptables DROP | FORWARD 체인 확인 |
| `Network unreachable` | --internal 네트워크 | 외부 접근 필요 여부 검토 |
| 호스트→컨테이너 접근 불가 | `-p` 누락 또는 IP 바인딩 문제 | `docker port` 확인 |

## 정리

- 네트워크 문제 진단 순서: 컨테이너 상태 → 네트워크 소속 → DNS → 포트 → iptables
- 같은 사용자 정의 네트워크에 없으면 컨테이너 이름으로 DNS 조회가 불가하다.
- `nicolaka/netshoot`은 최소 이미지에서 네트워크 진단 도구를 임시로 제공하는 표준 솔루션이다.
- iptables DROP은 모든 네트워크 진단을 혼란스럽게 만드는 숨겨진 원인이 될 수 있다.

---

**지난 글:** [Docker 네트워크 격리: 컨테이너 간 통신 제어](/posts/docker-network-isolation/)

**다음 글:** [Docker Compose 개요: 멀티 컨테이너 앱 관리](/posts/compose-overview/)

<br>
읽어주셔서 감사합니다. 😊
