---
title: "ss · netstat로 네트워크 연결 상태 파악하기"
description: "ss와 netstat 명령어로 TCP/UDP 연결 상태, LISTEN 포트, TIME_WAIT 수, 프로세스 정보를 확인하는 방법을 실무 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["ss", "netstat", "TCP상태", "LISTEN", "ESTABLISHED", "TIME_WAIT", "네트워크진단", "포트확인"]
featured: false
draft: false
---

[지난 글](/posts/network-cdn-deep/)에서 CDN의 심화 구조를 다뤘다. 이제 시리즈는 네트워크 진단 도구 영역으로 넘어간다. 서버에 접속해서 "지금 어떤 포트가 열려있지?", "이 연결은 왜 TIME_WAIT인거지?" 같은 질문에 답하려면 **ss**와 **netstat**을 알아야 한다.

## ss vs netstat

`netstat`은 전통적인 네트워크 진단 도구로 `net-tools` 패키지에 포함된다. 최신 리눅스 배포판은 기본으로 포함하지 않는 경우가 많다. `ss`는 `iproute2` 패키지에 포함되며 커널 소켓 인터페이스를 직접 조회해 **더 빠르고 정보가 풍부**하다.

| 항목 | ss | netstat |
|---|---|---|
| 패키지 | iproute2 (기본 설치) | net-tools (별도 설치) |
| 속도 | 빠름 (Netlink 소켓) | 느림 (/proc 파일 파싱) |
| TCP 정보 | RTT, 윈도우, 재전송 등 | 제한적 |
| 활성 유지 | ✅ 권장 | 레거시 |

## ss 기본 사용법

![ss -tunap 출력 구조](/assets/posts/network-ss-netstat-output.svg)

### 주요 옵션

```bash
ss -tunap

# -t: TCP 소켓만
# -u: UDP 소켓만
# -n: IP·포트를 이름 변환 없이 숫자로 표시
# -a: 모든 상태 (LISTEN 포함)
# -p: 소켓을 사용 중인 프로세스명·PID·fd 번호 표시
```

### 출력 컬럼 해석

- **Netid**: `tcp`, `udp`, `unix` 등 소켓 타입
- **State**: 연결 상태 (LISTEN, ESTAB, TIME-WAIT, CLOSE-WAIT 등)
- **Recv-Q**: 커널 수신 버퍼에 쌓였지만 프로세스가 아직 읽지 않은 바이트 수. 0이어야 정상.
- **Send-Q**: 전송됐지만 ACK 미수신 데이터. 0이어야 정상. 값이 크면 상대방이 느리거나 네트워크 문제.
- **Local Address:Port**: 로컬 IP와 포트
- **Peer Address:Port**: 원격 IP와 포트

## TCP 연결 상태

```
ss -tn state established     # ESTABLISHED 연결만
ss -tn state listen          # LISTEN 소켓만
ss -tn state time-wait       # TIME-WAIT 소켓만
ss -tn state close-wait      # CLOSE-WAIT 소켓만
```

### 상태별 의미

| 상태 | 의미 | 주의 포인트 |
|---|---|---|
| **LISTEN** | 포트 열고 연결 대기 중 | Recv-Q = backlog 큐 가득 찬 수 |
| **ESTABLISHED** | 연결 맺어진 활성 상태 | 과도하게 많으면 연결 누수 점검 |
| **TIME-WAIT** | 연결 종료 후 2MSL 대기 | 많으면 /proc/sys/net/ipv4/tcp_tw_reuse 검토 |
| **CLOSE-WAIT** | 상대방이 FIN 보냈지만 앱이 아직 close() 안 함 | 앱 버그 의심 — 누수 가능성 |
| **SYN-RECV** | 3-way handshake 진행 중 | 많으면 SYN Flood 공격 의심 |

## 실무 진단 패턴

![ss / netstat 치트시트](/assets/posts/network-ss-netstat-cheatsheet.svg)

### 특정 포트 연결 수 세기

```bash
# 80 포트에 연결된 클라이언트 수
ss -tn dport :80 | grep ESTAB | wc -l

# 80 포트에 LISTEN 중인 프로세스
ss -tlnp sport :80
```

### 연결 상태별 수 집계

```bash
# ss로
ss -tan | awk 'NR>1 {print $2}' | sort | uniq -c | sort -rn

# netstat으로
netstat -an | awk '{print $6}' | sort | uniq -c | sort -rn
```

### TIME-WAIT 과다 해결

TIME-WAIT 소켓이 수만 개 쌓이면 로컬 포트가 소진될 수 있다.

```bash
# 현재 TIME-WAIT 수 확인
ss -tan state time-wait | wc -l

# 재사용 허용 (연결 완전 종료 전 포트 재활용)
echo 1 > /proc/sys/net/ipv4/tcp_tw_reuse

# 영구 적용
echo "net.ipv4.tcp_tw_reuse = 1" >> /etc/sysctl.conf
sysctl -p
```

### 소켓 상세 정보 (RTT 포함)

```bash
ss -tei state established
# rto:200ms rtt:1.2ms/0.8ms ato:40ms mss:1460
# → RTT 1.2ms, 재전송 타임아웃 200ms, MSS 1460
```

## netstat 자주 쓰는 패턴

```bash
# 라우팅 테이블 (ip route로 대체 가능)
netstat -rn

# 네트워크 인터페이스 통계
netstat -i

# 멀티캐스트 그룹 멤버십
netstat -g

# 유닉스 도메인 소켓 목록
netstat -xl
```

## CLOSE-WAIT 디버깅

CLOSE-WAIT이 증가하면 앱 코드에서 소켓을 닫지 않는 버그다.

```bash
# CLOSE-WAIT 소켓과 프로세스 확인
ss -tnp state close-wait

# 해당 PID의 열린 파일 디스크립터 수
ls -l /proc/{PID}/fd | wc -l
# 수가 계속 늘면 소켓 누수 확정
```

---

**지난 글:** [CDN 심화 — 엣지 로직·Anycast·성능 최적화](/posts/network-cdn-deep/)

**다음 글:** [dig · nslookup으로 DNS 쿼리 직접 분석하기](/posts/network-dig-nslookup/)

<br>
읽어주셔서 감사합니다. 😊
