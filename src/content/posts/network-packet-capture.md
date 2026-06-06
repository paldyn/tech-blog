---
title: "tcpdump · Wireshark로 패킷 직접 캡처하기"
description: "tcpdump와 Wireshark로 네트워크 패킷을 캡처·분석하는 방법, BPF 필터 문법, TCP 플래그 읽는 법, pcap 파일 저장과 오프라인 분석까지 실무 위주로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["tcpdump", "Wireshark", "패킷캡처", "BPF필터", "pcap", "네트워크분석", "TCP플래그"]
featured: false
draft: false
---

[지난 글](/posts/network-dig-nslookup/)에서 DNS 레이어를 dig으로 분석했다. 한 단계 더 낮은 곳, 실제 네트워크를 흐르는 **패킷**을 직접 캡처하고 분석하는 도구가 **tcpdump**와 **Wireshark**다. 연결이 왜 안 되는지, 어떤 데이터가 오가는지 TCP 레벨까지 들여다볼 수 있다.

## tcpdump 기본

`tcpdump`는 CLI 기반 패킷 캡처 도구로 대부분의 리눅스 서버에서 바로 사용할 수 있다. 루트 권한이 필요하다.

```bash
# 모든 인터페이스에서 캡처
sudo tcpdump -i any

# 특정 인터페이스에서 캡처
sudo tcpdump -i eth0

# 주요 옵션
# -n:  IP 역방향 조회 생략 (빠름)
# -nn: IP + 포트 이름 변환 생략
# -v:  상세 출력 (-vv: 더 상세)
# -c N: N개 패킷 후 종료
# -s 0: 전체 패킷 캡처 (기본 96바이트 스냅샷 제한 해제)
```

## 출력 구조 해부

![tcpdump 출력 구조](/assets/posts/network-packet-capture-tcpdump.svg)

```
시각                   src IP.포트 > dst IP.포트:  플래그  시퀀스  크기
14:22:01.123456  IP 10.0.0.5.52001 > 1.2.3.4.80: Flags [S], seq 0, win 65535, length 0
```

### TCP 플래그

| 플래그 | 의미 | 언제 |
|---|---|---|
| `S` | SYN | 연결 시작 |
| `S.` | SYN-ACK | 서버 연결 수락 |
| `P` | PUSH | 데이터 전송 |
| `.` | ACK | 수신 확인 |
| `F` | FIN | 연결 종료 요청 |
| `R` | RST | 즉각 연결 종료 |

## BPF 필터

![BPF 필터 문법](/assets/posts/network-packet-capture-bpf-filters.svg)

BPF(Berkeley Packet Filter)는 커널 레벨에서 패킷을 필터링하는 표현식이다. tcpdump와 Wireshark 모두 동일한 문법을 사용한다.

### 자주 사용하는 필터

```bash
# HTTP 트래픽만
tcpdump -i eth0 -nn tcp port 80

# 특정 IP와 주고받는 트래픽
tcpdump -i eth0 -nn host 1.2.3.4

# 조합: 특정 IP의 HTTPS만
tcpdump -i eth0 -nn host 1.2.3.4 and port 443

# SYN 플래그만 (새 연결 시도만)
tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0'

# RST 패킷만 (연결 거부/리셋 감지)
tcpdump -i eth0 'tcp[tcpflags] & tcp-rst != 0'

# 특정 서브넷
tcpdump -i eth0 net 192.168.1.0/24

# UDP DNS 쿼리
tcpdump -i eth0 -nn udp port 53
```

## pcap 파일 저장과 분석

서버에서 캡처한 패킷을 로컬 Wireshark로 분석하는 워크플로우가 실무에서 흔하다.

```bash
# 서버에서 캡처해 파일 저장
sudo tcpdump -i eth0 -nn -s 0 \
  -w /tmp/capture.pcap \
  -G 60 \    # 60초마다 새 파일
  -C 100 \   # 최대 100MB
  host 1.2.3.4

# 저장된 pcap 파일을 tcpdump로 읽기
tcpdump -r /tmp/capture.pcap -nn

# 로컬로 다운로드
scp user@server:/tmp/capture.pcap .
# 로컬 Wireshark로 열기
```

### SSH 통해 실시간 스트리밍

```bash
# SSH 파이프라인으로 실시간 Wireshark 분석 (macOS/Linux)
ssh user@server "sudo tcpdump -i eth0 -nn -s 0 -U -w - host 1.2.3.4" \
  | wireshark -k -i -
```

## Wireshark 필터

Wireshark에서는 캡처 후 분석 필터를 추가로 적용할 수 있다.

```
# 특정 IP
ip.addr == 1.2.3.4

# HTTP 요청만
http.request

# TCP SYN
tcp.flags.syn == 1 and tcp.flags.ack == 0

# DNS A 레코드 응답
dns.qry.type == 1 and dns.flags.response == 1

# TLS Client Hello만
tls.handshake.type == 1
```

## 실무 디버깅 시나리오

### 연결 거부 확인

```bash
sudo tcpdump -i eth0 -nn 'tcp[tcpflags] & tcp-rst != 0' and port 8080
# RST 패킷이 보이면 서버가 연결 거부 → 프로세스가 해당 포트를 안 듣거나, 방화벽 차단
```

### 패킷 유실 확인

```bash
# tcpdump 실행 후 Ctrl+C
# 마지막 줄에 통계 출력
# 10 packets captured
# 10 packets received by filter
# 0 packets dropped by kernel  ← 0이어야 정상
```

### 재전송 확인 (Wireshark)

Wireshark에서 `tcp.analysis.retransmission` 필터를 적용하면 모든 재전송 패킷을 볼 수 있다. 재전송이 많으면 네트워크 품질 문제 또는 수신 버퍼 과부하를 의심한다.

---

**지난 글:** [dig · nslookup으로 DNS 쿼리 직접 분석하기](/posts/network-dig-nslookup/)

**다음 글:** [traceroute · mtr로 네트워크 경로 추적하기](/posts/network-traceroute-mtr/)

<br>
읽어주셔서 감사합니다. 😊
