---
title: "netstat·ss — 소켓과 연결 상태 분석"
description: "TCP 소켓 상태(LISTEN·ESTABLISHED·CLOSE_WAIT·TIME_WAIT), ss와 netstat 옵션 비교, 포트 점유 프로세스 확인, 연결 수 모니터링 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "ss", "netstat", "tcp", "socket", "listen", "established", "close-wait", "time-wait", "iproute2"]
featured: false
draft: false
---

[지난 글](/posts/linux-ping-traceroute/)에서 ping·traceroute로 네트워크 연결성을 확인했습니다. 이번에는 한 단계 더 들어가 **소켓과 연결 상태**를 분석합니다. "포트 8080이 이미 사용 중입니다"라는 오류나 "왜 연결이 쌓이고 있지?"라는 상황에서 `ss`와 `netstat`이 답을 줍니다.

## ss vs netstat

`netstat`은 `/proc/net/tcp`를 읽어 출력하는 구식 도구입니다. 연결이 수만 개에 달하면 매우 느립니다. `ss`(socket statistics)는 커널 **netlink** 인터페이스를 직접 사용해 10배 이상 빠릅니다. 최신 배포판에서는 `netstat` 대신 `ss`를 쓰세요.

```bash
# netstat 설치 (없는 경우)
sudo apt install net-tools

# ss는 iproute2에 포함 (기본 설치)
ss --version
```

## ss 기본 옵션

```bash
# 자주 쓰는 플래그 조합
# -t: TCP  -u: UDP  -n: 이름 해석 안 함  -p: 프로세스 표시
# -l: LISTEN 상태만  -a: 모든 상태  -s: 요약 통계

# 모든 TCP 연결 + 프로세스
ss -tnp

# LISTEN 중인 포트 (서비스 확인)
ss -tlnp

# UDP 소켓
ss -unlp

# 모든 소켓 요약
ss -s
```

![ss · netstat 핵심 명령어](/assets/posts/linux-netstat-ss-commands.svg)

### ss 출력 예시

```
State   Recv-Q  Send-Q  Local Address:Port   Peer Address:Port  Process
LISTEN       0     128     0.0.0.0:22          0.0.0.0:*      users:(("sshd",pid=1234))
ESTAB        0       0  192.168.1.10:22   192.168.1.5:51234    users:(("sshd",pid=5678))
```

각 컬럼의 의미:
- `Recv-Q`: 수신 버퍼에 쌓인 데이터 (높으면 앱이 처리 못 하는 중)
- `Send-Q`: 전송 버퍼에 쌓인 데이터 (높으면 네트워크 병목)
- `Local/Peer Address:Port`: 로컬·원격 주소와 포트

## 소켓 상태 이해

![TCP 소켓 상태](/assets/posts/linux-netstat-ss-states.svg)

주요 상태를 알아두면 장애 원인을 빠르게 파악할 수 있습니다.

| 상태 | 설명 | 주의 상황 |
|------|------|-----------|
| `LISTEN` | 포트 수신 대기 | 서버 시작 확인 |
| `ESTABLISHED` | 연결 활성 | 정상 |
| `CLOSE_WAIT` | 원격 종료, 앱이 아직 안 닫음 | 누수 버그 의심 |
| `TIME_WAIT` | 2MSL 대기 (60–120초) | 많으면 포트 고갈 위험 |
| `SYN_RECV` | 핸드셰이크 진행 중 | 다수면 SYN Flood 의심 |

## 포트 점유 프로세스 확인

서비스 시작 시 "Address already in use" 오류가 나면:

```bash
# 80번 포트를 점유한 프로세스
ss -tlnp | grep ':80'

# lsof 활용 (보완)
sudo lsof -i :80

# fuser 로 직접 PID
sudo fuser 80/tcp
```

## 필터링

`ss`는 강력한 필터를 지원합니다.

```bash
# 목적지 포트 443
ss -tnp dport = :443

# 출발지 포트 80
ss -tnp sport = :80

# 특정 IP로의 연결
ss -tnp dst 8.8.8.8

# 특정 서브넷
ss -tnp dst 192.168.1.0/24

# ESTABLISHED 상태만
ss -tnp state established

# FIN 계열 상태 모두
ss -tnp state fin-wait-1 state fin-wait-2 state closing
```

## 연결 수 모니터링

```bash
# 상태별 연결 수 집계
ss -s

# ESTABLISHED 수만
ss -tnp state established | wc -l

# 1초마다 갱신
watch -n1 'ss -s'

# 목적지 IP별 연결 수 정렬
ss -tnp | awk 'NR>1{print $5}' | cut -d: -f1 | \
  sort | uniq -c | sort -rn | head -20
```

## TIME_WAIT 문제 대응

고부하 서버에서 TIME_WAIT 수만 개가 쌓여 로컬 포트가 부족해지면:

```bash
# 현재 TIME_WAIT 수
ss -s | grep "time-wait"

# 커널 파라미터 조정 (영구: /etc/sysctl.conf)
sudo sysctl -w net.ipv4.tcp_tw_reuse=1
sudo sysctl -w net.ipv4.tcp_fin_timeout=30

# 로컬 포트 범위 확장
sudo sysctl -w net.ipv4.ip_local_port_range="1024 65535"
```

## Unix 도메인 소켓

파일시스템 기반 IPC 소켓도 확인할 수 있습니다.

```bash
# Unix 소켓 전체
ss -xnp

# 특정 소켓 경로 필터
ss -xnp | grep docker
```

## 정리

`ss -tlnp`로 열린 포트를, `ss -tnp`로 활성 연결을, `ss -s`로 전체 요약을 확인합니다. CLOSE_WAIT가 계속 쌓이면 애플리케이션이 소켓을 닫지 않는 버그이고, TIME_WAIT가 너무 많으면 `tcp_tw_reuse`와 포트 범위 확장으로 완화합니다.

---

**지난 글:** [ping·traceroute — 네트워크 연결성 진단](/posts/linux-ping-traceroute/)

**다음 글:** [dig·nslookup·host — DNS 질의 도구 완전 가이드](/posts/linux-dig-nslookup-host/)

<br>
읽어주셔서 감사합니다. 😊
