---
title: "Docker host 네트워크: 격리 없는 최고 성능"
description: "Docker host 네트워크 드라이버의 동작 원리, bridge와의 성능 차이, 그리고 macOS/Windows에서 주의할 점을 실용적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "host", "성능", "NAT", "Linux"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-bridge/)에서 bridge 네트워크의 veth pair와 NAT 동작을 살펴봤다. 이번에는 그 NAT를 완전히 제거한 **host 네트워크 드라이버**를 다룬다.

## host 네트워크란

`--network host`를 지정하면 컨테이너는 독립된 네트워크 네임스페이스 없이 **호스트의 네트워크 스택을 그대로 사용**한다. 컨테이너 내부에서 `ip addr`를 실행하면 호스트의 인터페이스가 그대로 보인다.

```bash
# host 네트워크로 nginx 실행
docker run -d --network host --name web nginx

# -p 옵션 필요 없음. nginx가 호스트의 80 포트를 직접 점유
curl http://localhost:80  # 바로 접근 가능
```

`-p 8080:80` 같은 포트 포워딩 설정이 필요 없다. 컨테이너가 80 포트에 리슨하면, 호스트의 80 포트에서도 즉시 접근된다.

## bridge vs host 구조 비교

![host 네트워크 vs bridge 네트워크 비교](/assets/posts/docker-network-host-diagram.svg)

bridge는 veth pair를 통해 docker0 브리지를 거치고, iptables NAT 레이어를 통과한다. host는 그 모든 경로를 건너뛰고 호스트 네트워크에 직접 연결한다.

## 성능 이점

host 네트워크의 핵심 장점은 NAT 오버헤드 제거다. 트래픽이 많거나 패킷 처리 지연에 민감한 애플리케이션에서 차이가 난다.

- UDP 기반 프로토콜 (DNS, DHCP, 게임 서버)
- 고빈도 HTTP 요청을 처리하는 API 서버
- 네트워크 모니터링 도구 (패킷 캡처)
- FTP Passive 모드처럼 동적 포트를 여는 서비스

```bash
# 성능 비교 예시: iperf3 서버를 host 네트워크로 실행
docker run -d --network host --name iperf-server \
  networkstatic/iperf3 -s

# 클라이언트에서 테스트
docker run --rm --network host \
  networkstatic/iperf3 -c localhost
```

## 사용 시 주의사항

![host 네트워크 사용 판단 기준](/assets/posts/docker-network-host-usecases.svg)

### 포트 충돌

host 네트워크에서는 여러 컨테이너가 같은 포트를 사용할 수 없다. bridge에서는 각 컨테이너가 다른 IP를 가져 포트 충돌이 없지만, host에서는 포트가 공유된다.

```bash
# 이미 nginx가 80 포트를 쓰고 있을 때
docker run --network host --name web2 nginx
# 실패: bind() failed (98: Address already in use)
```

### macOS / Windows 제한

host 네트워크는 **Linux 전용**이다. macOS와 Windows의 Docker Desktop은 내부에 Linux VM을 사용하므로, `--network host`는 호스트 Mac/Windows가 아닌 그 VM의 네트워크를 공유한다. 결과적으로 기대와 다르게 동작할 수 있다.

```bash
# macOS에서 확인
docker run --rm --network host alpine ip addr
# Mac 네트워크가 아닌 VM 내부 네트워크가 보임
```

### 보안 고려

컨테이너가 호스트의 모든 네트워크 인터페이스에 접근할 수 있다. 보안 격리가 필요한 서비스에는 적합하지 않다.

## 실용적인 사용 예

```bash
# tcpdump로 호스트 트래픽 캡처 (컨테이너에 tcpdump 설치 필요)
docker run --rm --network host \
  --cap-add NET_ADMIN \
  --cap-add NET_RAW \
  nicolaka/netshoot \
  tcpdump -i eth0 -w /tmp/capture.pcap

# Prometheus Node Exporter — 호스트 메트릭 수집
docker run -d \
  --network host \
  --pid host \
  --name node-exporter \
  prom/node-exporter
```

## Compose에서 host 네트워크

```yaml
services:
  monitor:
    image: prom/node-exporter
    network_mode: "host"
    pid: "host"
```

`network_mode: "host"`로 지정한다. 이 서비스는 `ports` 매핑을 사용할 수 없고 사용해도 무시된다.

---

**지난 글:** [Docker bridge 네트워크 완전 분석: veth, docker0, NAT](/posts/docker-network-bridge/)

**다음 글:** [Docker none 네트워크: 완전한 네트워크 격리](/posts/docker-network-none/)

<br>
읽어주셔서 감사합니다. 😊
