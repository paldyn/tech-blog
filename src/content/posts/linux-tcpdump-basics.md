---
title: "tcpdump — 패킷 캡처 기초"
description: "tcpdump의 핵심 옵션, BPF 필터 문법(host·port·tcp·and/or/not), pcap 파일 저장과 Wireshark 연동, TCP 플래그 해석, 실전 네트워크 진단 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "tcpdump", "bpf", "pcap", "wireshark", "network-debug", "tcp-flags", "packet-capture", "tshark"]
featured: false
draft: false
---

[지난 글](/posts/linux-curl-wget/)에서 HTTP 도구를 다뤘습니다. `ping`과 `curl`로도 진단이 안 될 때, 실제 패킷 수준에서 무슨 일이 일어나는지 확인할 수 있는 도구가 **tcpdump**입니다. 네트워크 인터페이스를 흐르는 패킷을 실시간으로 캡처하고 필터링합니다.

## 기본 사용

```bash
# 설치
sudo apt install tcpdump

# 기본 (기본 인터페이스, 이름 해석 포함)
sudo tcpdump

# 특정 인터페이스
sudo tcpdump -i eth0

# DNS 해석 없이 (빠름, -n)
sudo tcpdump -i eth0 -n

# 패킷 수 제한 (-c 100개)
sudo tcpdump -i eth0 -n -c 100

# 모든 인터페이스
sudo tcpdump -i any
```

### 주요 옵션

| 옵션 | 의미 |
|------|------|
| `-i IFACE` | 캡처 인터페이스 |
| `-n` | IP/포트 이름 해석 안 함 |
| `-nn` | 프로토콜 이름까지 숫자로 |
| `-v / -vv / -vvv` | 상세도 단계별 |
| `-c N` | N개 패킷 후 종료 |
| `-w FILE` | pcap 파일로 저장 |
| `-r FILE` | pcap 파일 읽기 |
| `-A` | 패킷 내용 ASCII로 |
| `-X` | 패킷 내용 HEX+ASCII |
| `-s 0` | 전체 패킷 저장 (기본 256바이트) |

## BPF 필터

tcpdump의 강점은 **Berkeley Packet Filter**입니다. 커널 단에서 미리 패킷을 선별해 오버헤드를 최소화합니다.

![tcpdump BPF 필터 문법](/assets/posts/linux-tcpdump-basics-filters.svg)

```bash
# 특정 호스트만
sudo tcpdump -i eth0 -n host 8.8.8.8

# 특정 포트
sudo tcpdump -i eth0 -n port 443

# 프로토콜
sudo tcpdump -i eth0 -n icmp
sudo tcpdump -i eth0 -n udp and port 53

# 복합 필터 (인용부호로 묶기)
sudo tcpdump -i eth0 -n 'tcp and (port 80 or port 443)'
sudo tcpdump -i eth0 -n 'host 10.0.0.1 and not port 22'

# 특정 서브넷
sudo tcpdump -i eth0 -n 'net 192.168.1.0/24'

# 소스/목적지 방향 지정
sudo tcpdump -i eth0 -n 'src host 10.0.0.1 and dst port 80'
```

## 출력 해석

![tcpdump 출력 해석](/assets/posts/linux-tcpdump-basics-output.svg)

```
14:32:10.123456 IP 192.168.1.100.51234 > 8.8.8.8.443: Flags [S]
```

- `14:32:10.123456`: 타임스탬프 (마이크로초)
- `IP`: L3 프로토콜
- `192.168.1.100.51234`: 소스 IP.포트
- `8.8.8.8.443`: 목적지 IP.포트
- `Flags [S]`: TCP SYN 패킷

TCP 3-way handshake가 보이면 `[S]` → `[S.]` → `[.]` 순서입니다. `[R]`이 나타나면 연결 리셋(방화벽 차단 또는 서버 거부)입니다.

## pcap 파일 저장과 분석

```bash
# 파일로 저장 (패킷 전체 크기 포함 -s 0)
sudo tcpdump -i eth0 -n -s 0 -w /tmp/capture.pcap 'port 443'

# 나중에 파일 읽기
tcpdump -r /tmp/capture.pcap

# 필터 적용해서 읽기
tcpdump -r /tmp/capture.pcap 'host 8.8.8.8'

# 저장하면서 동시에 화면 출력
sudo tcpdump -i eth0 -l -n | tee /tmp/output.txt
```

### Wireshark에서 열기

```bash
# pcap 파일을 scp로 로컬로 가져와서 Wireshark로 분석
scp user@server:/tmp/capture.pcap ./

# 서버에서 tshark (Wireshark CLI)
sudo apt install tshark
tshark -r capture.pcap -Y "http.request.method == GET"
```

## 실전 진단 시나리오

### DNS 쿼리 모니터링

```bash
sudo tcpdump -i eth0 -n 'udp port 53'
# 어떤 도메인을 쿼리하는지 확인
sudo tcpdump -i eth0 -n -A 'udp port 53'
```

### HTTP 요청 내용 확인 (평문)

```bash
sudo tcpdump -i eth0 -n -A 'tcp port 80 and (tcp[tcpflags] & tcp-push != 0)'
```

### SYN Flood 탐지

```bash
sudo tcpdump -i eth0 -n 'tcp[tcpflags] == tcp-syn' | \
  awk '{print $5}' | cut -d. -f1-4 | sort | uniq -c | sort -rn | head
```

### 특정 서버와 연결 확인

```bash
# DB 서버(5432)로 가는 모든 패킷
sudo tcpdump -i any -n 'host 10.10.0.5 and port 5432'
```

### 레이턴시 측정

```bash
# SYN ~ SYN-ACK 시간 차이 확인 (-tttt 절대 시간)
sudo tcpdump -i eth0 -n -tttt 'tcp[tcpflags] & (tcp-syn|tcp-ack) != 0 and host 8.8.8.8'
```

## tcpdump vs Wireshark

| 항목 | tcpdump | Wireshark |
|------|---------|-----------|
| 환경 | CLI, SSH 원격 | GUI |
| 필터 | BPF (캡처 단계) | Display Filter (후처리) |
| 실시간 | 터미널 출력 | 패킷 스트림 그래프 |
| 협업 | pcap 파일 전달 | pcap 직접 열기 |

서버에서 `tcpdump -w`로 캡처하고, 로컬 Wireshark로 분석하는 워크플로우가 일반적입니다.

## 정리

tcpdump의 핵심은 **BPF 필터**입니다. `host`, `port`, `tcp/udp/icmp`를 `and/or/not`으로 조합해 필요한 패킷만 효율적으로 잡습니다. `-w`로 pcap을 저장해두면 나중에 Wireshark나 tshark로 깊이 분석할 수 있습니다. TCP `Flags [R]`이 반복되면 방화벽 차단, `[S.]` 없이 `[S]`만 반복되면 서버 다운이나 경로 문제를 의심하세요.

---

**지난 글:** [curl·wget — HTTP 요청과 파일 다운로드](/posts/linux-curl-wget/)

**다음 글:** [iptables — 리눅스 방화벽 기초](/posts/linux-iptables-basics/)

<br>
읽어주셔서 감사합니다. 😊
