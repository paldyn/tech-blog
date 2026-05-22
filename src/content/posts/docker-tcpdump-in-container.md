---
title: "tcpdump로 컨테이너 네트워크 패킷 분석하기"
description: "Docker 컨테이너 내부와 네트워크 네임스페이스에서 tcpdump로 패킷을 캡처하는 방법, netshoot 사이드카 패턴, Wireshark 실시간 분석, tshark를 활용한 pcap 분석을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "tcpdump", "wireshark", "tshark", "네트워크", "패킷분석", "디버깅", "netshoot"]
featured: false
draft: false
---

[지난 글](/posts/docker-strace-attach/)에서 strace로 시스템콜을 추적하는 방법을 다뤘다. 네트워크 문제를 디버깅할 때는 시스템콜 레벨보다 한 단계 더 낮은 패킷 레벨 분석이 필요한 경우가 있다. 어떤 패킷이 실제로 전송됐는지, TCP Handshake가 완료됐는지, TLS 연결이 어디서 실패하는지 `tcpdump`가 명확히 보여준다.

## 컨테이너에서 tcpdump를 쓰기 어려운 이유

컨테이너는 네트워크 네임스페이스로 격리되어 있어 호스트에서 `tcpdump -i eth0`를 실행하면 컨테이너 트래픽이 보이지 않는다. 컨테이너의 `eth0`는 호스트의 veth pair이므로 올바른 인터페이스를 지정해야 한다.

![컨테이너 패킷 캡처 방법](/assets/posts/docker-tcpdump-in-container-capture.svg)

## 방법 1: 컨테이너 내부에서 tcpdump

컨테이너 이미지에 tcpdump가 포함되어 있다면 가장 간단하다.

```bash
# alpine 이미지에서 tcpdump 설치 후 사용
docker exec myapp apk add --no-cache tcpdump
docker exec myapp tcpdump -i eth0 -n -s 0 -c 100

# pcap 파일로 저장 후 분석
docker exec myapp tcpdump -i eth0 -n -s 0 -w /tmp/capture.pcap
docker cp myapp:/tmp/capture.pcap ./capture.pcap
```

하지만 프로덕션 이미지에는 tcpdump가 없는 경우가 많고, 설치하면 이미지가 더러워진다.

## 방법 2: nsenter로 컨테이너 네트워크 네임스페이스 진입

호스트의 tcpdump를 컨테이너 네트워크 네임스페이스에서 실행하는 방법이다.

```bash
PID=$(docker inspect --format '{{.State.Pid}}' myapp)

# 네트워크 네임스페이스만 진입
sudo nsenter --target "$PID" --net -- \
  tcpdump -i eth0 -n -s 0 -c 200

# pcap 저장
sudo nsenter --target "$PID" --net -- \
  tcpdump -i eth0 -n -s 0 -w /tmp/myapp.pcap
```

`--net` 플래그만 지정하므로 파일시스템은 호스트를 그대로 사용한다. 컨테이너에 tcpdump가 없어도 호스트의 tcpdump를 사용할 수 있다.

## 방법 3: netshoot 사이드카 컨테이너 (권장)

`nicolaka/netshoot`은 네트워크 디버깅 도구 모음 이미지다. `--network container:myapp`으로 동일 네트워크 네임스페이스를 공유해 컨테이너처럼 트래픽을 캡처한다.

```bash
# 실시간 트래픽 확인
docker run --rm -it \
  --network container:myapp \
  nicolaka/netshoot \
  tcpdump -i eth0 -n port 5432

# 파일 저장 (-v로 호스트 디렉터리 마운트)
docker run --rm \
  --network container:myapp \
  -v $(pwd):/captures \
  nicolaka/netshoot \
  tcpdump -i eth0 -n -s 0 -w /captures/myapp.pcap

# 또는 stdout으로 출력해 분석
docker run --rm \
  --network container:myapp \
  nicolaka/netshoot \
  tcpdump -i eth0 -n -s 0 -w - 2>/dev/null | \
  tshark -r - -Y "tcp.flags.reset==1"
```

## 방법 4: Wireshark 실시간 분석

로컬 개발 환경에서 Wireshark GUI로 실시간 분석하려면 tcpdump 출력을 파이프로 연결한다.

```bash
# 리눅스 (Wireshark가 로컬에 설치된 경우)
sudo nsenter --target "$PID" --net -- \
  tcpdump -i eth0 -U -s 0 -w - 2>/dev/null | \
  wireshark -k -i -

# 원격 서버에서 SSH 터널로 로컬 Wireshark로 전송
ssh user@server "sudo nsenter --target $PID --net -- \
  tcpdump -i eth0 -U -s 0 -w -" | wireshark -k -i -
```

`-U` 플래그는 패킷이 들어올 때마다 즉시 출력한다(unbuffered). 없으면 버퍼가 차야 전송된다.

## tcpdump 필터 & tshark 분석

![tcpdump 필터 & tshark 분석 패턴](/assets/posts/docker-tcpdump-in-container-analysis.svg)

## 실전 시나리오

### DB 연결 타임아웃 디버깅

```bash
# PostgreSQL 연결 시도 추적
docker run --rm -it \
  --network container:myapp \
  nicolaka/netshoot \
  tcpdump -i eth0 -n "host 10.0.0.5 and port 5432"

# SYN 패킷은 보내지만 응답이 없으면 → DB 방화벽 문제
# SYN-ACK까지는 오지만 앱이 RST 보내면 → 앱 수준 연결 거부
# TCP Handshake 완성 후 데이터 없으면 → 인증/TLS 문제
```

### 외부 API 호출 확인

```bash
# HTTPS 트래픽 (페이로드는 암호화되어 있지만 연결 여부 확인 가능)
docker run --rm -it \
  --network container:myapp \
  nicolaka/netshoot \
  tcpdump -i eth0 -n "port 443" -c 50

# DNS 쿼리 확인 (어떤 도메인을 조회하는지)
docker run --rm -it \
  --network container:myapp \
  nicolaka/netshoot \
  tcpdump -i eth0 -n "port 53" -s 200
```

### pcap 파일 분석

```bash
# tshark: HTTP 요청/응답 분석
tshark -r capture.pcap -Y "http" -T fields \
  -e frame.time -e ip.src -e ip.dst \
  -e http.request.method -e http.request.uri \
  -e http.response.code

# TCP RST 패킷 (연결 강제 종료 원인 파악)
tshark -r capture.pcap -Y "tcp.flags.reset==1" \
  -T fields -e ip.src -e ip.dst -e tcp.srcport -e tcp.dstport

# 재전송 패킷 (패킷 손실 또는 네트워크 불안정)
tshark -r capture.pcap -Y "tcp.analysis.retransmission"

# 통신 플로우 요약
tshark -r capture.pcap -q -z conv,tcp
```

### Compose 네트워크 문제 확인

```bash
# compose로 실행된 두 서비스 간 트래픽 확인
# myapp → db 통신이 실제로 이루어지는지 확인
docker run --rm -it \
  --network myproject_default \
  nicolaka/netshoot \
  tcpdump -i eth0 -n "host db and port 5432"
```

## Kubernetes에서 패킷 캡처

```bash
# kubectl debug로 임시 컨테이너에서 tcpdump
kubectl debug -it mypod \
  --image=nicolaka/netshoot \
  --target=myapp-container -- \
  tcpdump -i eth0 -n -w /tmp/cap.pcap

# Ksniff (kubectl 플러그인)
kubectl sniff mypod -c myapp-container -o ./capture.pcap
```

---

**지난 글:** [strace로 컨테이너 시스템콜 추적하기](/posts/docker-strace-attach/)

<br>
읽어주셔서 감사합니다. 😊
