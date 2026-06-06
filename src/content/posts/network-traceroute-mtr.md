---
title: "traceroute · mtr로 네트워크 경로 추적하기"
description: "traceroute와 mtr 명령어로 네트워크 홉 경로를 파악하고, 패킷 유실·레이턴시 급증 구간을 찾아내는 방법을 실무 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["traceroute", "mtr", "TTL", "홉", "레이턴시", "패킷유실", "네트워크경로", "RTT"]
featured: false
draft: false
---

[지난 글](/posts/network-packet-capture/)에서 tcpdump로 패킷을 직접 캡처했다. 이번엔 "내 패킷이 목적지까지 어떤 경로로 가는가?"를 추적하는 도구를 다룬다. 연결이 느리거나 불안정할 때 어느 구간에서 문제가 생기는지 **traceroute**와 **mtr**이 알려준다.

## traceroute 동작 원리

traceroute는 **TTL(Time To Live)** 값을 1부터 순차적으로 늘려가며 프로브 패킷을 보낸다.

```
TTL=1 패킷 → 첫 번째 라우터에서 TTL 만료 → ICMP Time Exceeded 반환 → 1홉 IP 확인
TTL=2 패킷 → 두 번째 라우터에서 만료 → 2홉 IP 확인
...
TTL=N 패킷 → 목적지 도달 → ICMP Port Unreachable / Echo Reply 반환
```

각 홉에 **3개의 프로브**를 보내고 각각의 왕복 시간(RTT)을 ms 단위로 표시한다.

![traceroute 출력 구조](/assets/posts/network-traceroute-mtr-output.svg)

## traceroute 사용법

```bash
# 기본 사용법
traceroute example.com

# -n: IP 역방향 조회 없이 숫자로 표시 (빠름)
traceroute -n example.com

# -T: TCP SYN으로 프로브 (ICMP 차단된 환경에서 유용, 루트 필요)
sudo traceroute -T -p 443 example.com

# -I: ICMP Echo 사용 (Windows tracert 방식)
sudo traceroute -I example.com

# 홉당 프로브 수 변경
traceroute -q 5 example.com   # 5개 프로브

# 최대 홉 제한
traceroute -m 20 example.com  # 최대 20홉
```

### `* * *` 의미

특정 홉에서 `* * *`이 나오는 경우는 두 가지다:

1. **라우터가 ICMP TTL Exceeded를 차단**: 실제 경로는 있지만 해당 라우터가 응답하지 않음. 이후 홉이 정상이면 무시해도 된다.
2. **실제 패킷 유실**: 특정 홉 이후로 응답이 없으면 그 구간에서 문제가 생긴 것.

## mtr — 실시간 경로 모니터링

`mtr`은 traceroute + ping을 합친 도구다. 지속적으로 프로브를 보내며 **패킷 유실률·RTT 통계**를 실시간으로 업데이트한다.

![mtr 실시간 모니터링 화면](/assets/posts/network-traceroute-mtr-screen.svg)

### mtr 기본 사용법

```bash
# 대화형 화면 (q로 종료)
mtr example.com

# 숫자로 표시 (역방향 조회 없음)
mtr -n example.com

# N회 측정 후 보고서 출력 (스크립트에 유용)
mtr -n --report --report-cycles=20 example.com

# JSON 출력
mtr -n --report --json example.com

# TCP 모드 (ICMP 차단 환경)
mtr -T -P 443 example.com
```

### mtr 출력 컬럼 해석

| 컬럼 | 의미 | 정상 범위 |
|---|---|---|
| **Loss%** | 패킷 유실률 | 0% (중간 홉의 경우 무시 가능) |
| **Snt** | 전송된 프로브 수 | - |
| **Last** | 가장 최근 RTT | 홉 위치에 따라 다름 |
| **Avg** | 평균 RTT | - |
| **Best** | 최소 RTT | 실제 전파 지연의 하한 |
| **Wrst** | 최대 RTT | 이상치 확인 |
| **StDev** | RTT 표준편차 (지터) | 낮을수록 안정적 |

## 문제 구간 찾기

### 레이턴시 급증 구간

```
홉 1:  0.4 ms
홉 2:  2.1 ms
홉 3:  2.3 ms
홉 4:  148 ms  ← 여기서 레이턴시가 급증 → 홉 3→4 구간에 문제
홉 5:  149 ms
```

이전 홉에 비해 RTT가 크게 높아지면 해당 **구간의 링크 품질 문제** 또는 **해당 라우터의 큐 지연**이다.

### 패킷 유실 구간

```
홉 3:  0.0% Loss
홉 4: 20.0% Loss  ← 여기서 유실 시작
홉 5: 20.0% Loss
```

특정 홉부터 Loss%가 생기고 이후 홉도 동일하면, 그 홉이 병목이다.

단, 중간 홉만 Loss%가 높고 이후 홉이 0%이면 해당 라우터가 ICMP를 rate limiting하는 것이다.

## traceroute 옵션 차이 (OS별)

| 항목 | Linux | macOS | Windows |
|---|---|---|---|
| 기본 프로브 | UDP | UDP | ICMP |
| 명령어 | traceroute | traceroute | tracert |
| TCP 모드 | traceroute -T | traceroute -T | (없음) |
| mtr | mtr | mtr (brew) | WinMTR |

---

**지난 글:** [tcpdump · Wireshark로 패킷 직접 캡처하기](/posts/network-packet-capture/)

**다음 글:** [HTTP란 무엇인가 — 웹 통신의 기초](/posts/http-what-is-http/)

<br>
읽어주셔서 감사합니다. 😊
