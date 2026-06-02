---
title: "TCP 연결 종료: 4-way 핸드셰이크와 Half-close"
description: "TCP 4-way 핸드셰이크, Half-close, TIME_WAIT, RST 강제 종료의 원리와 실전 문제 해결 방법을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["TCP", "4way핸드셰이크", "FIN", "TIME_WAIT", "RST", "Half-close", "연결종료"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-3way-handshake/)에서 TCP 3-way 핸드셰이크로 연결을 수립하는 과정을 살펴봤다. 연결을 닫는 과정은 훨씬 복잡하다. **4-way 핸드셰이크**, **Half-close**, **TIME_WAIT** 상태, 그리고 비정상 종료인 **RST**까지 이해해야 TCP 연결의 전체 생명 주기가 완성된다.

## 왜 4번인가? FIN과 ACK이 분리되는 이유

3-way 핸드셰이크에서 SYN+ACK을 하나로 묶을 수 있었던 것은 두 방향의 연결 수립이 동시에 이루어지기 때문이다. 반면 연결 종료는 **단방향**으로 이루어진다. 한쪽이 FIN을 보내도 상대방은 아직 보낼 데이터가 남아 있을 수 있다. 그래서 ACK과 FIN을 별도로 전송한다.

```text
4-way 종료 순서
─────────────────────────────────────────────
1. Active Close → FIN          (더 이상 안 보냄)
2. Passive Close ← ACK         (FIN 확인)
   [Half-close: Passive가 잔여 데이터 전송 가능]
3. Passive Close → FIN         (이제 나도 닫겠음)
4. Active Close ← ACK          (종료 확인)
   Active Close: TIME_WAIT(2MSL) → CLOSED
   Passive Close: CLOSED
─────────────────────────────────────────────
```

## 4-way 흐름 다이어그램

![TCP 4-way 핸드셰이크](/assets/posts/network-tcp-connection-termination-flow.svg)

1~2단계 사이, 즉 Passive Close가 ACK을 보낸 직후 FIN을 보내기 전 구간이 **Half-close**다. 이 상태에서 Active Close 측은 더 이상 데이터를 보낼 수 없지만(수신은 가능), Passive Close 측은 아직 데이터를 전송할 수 있다. 예를 들어 HTTP 서버가 응답 Body를 다 보낸 뒤 FIN을 전송하는 것이 이 구간이다.

## TIME_WAIT: 왜 2MSL을 기다리는가

Active Close 측이 마지막 ACK을 보낸 뒤 즉시 CLOSED 상태가 되지 않고 `TIME_WAIT`에 머무는 이유는 두 가지다.

```text
TIME_WAIT = 2 × MSL (Maximum Segment Lifetime, 보통 60초 → 총 120초)

이유 1: 마지막 ACK 유실 시 재전송
  → 서버(Passive)가 ACK을 못 받으면 FIN 재전송
  → TIME_WAIT 중인 클라이언트가 이를 받아 ACK 재전송

이유 2: 이전 연결의 지연 패킷 오염 방지
  → 같은 4-tuple로 새 연결을 맺었을 때
  → 이전 연결에서 네트워크에 떠 있던 패킷이 도착하면 오염
  → 2MSL 후에는 그 패킷이 모두 만료되었음이 보장됨
```

## FIN vs RST

![FIN vs RST 비교](/assets/posts/network-tcp-connection-termination-rst.svg)

RST는 **즉시 연결을 끊는** 비정상 종료 신호다. FIN처럼 ACK을 기다리지 않는다. 버퍼의 데이터도 버린다. RST가 발생하는 상황은 다음과 같다.

```bash
# RST 발생 시나리오
# 1. 닫힌 포트에 연결 시도 → 서버가 RST 전송
# 2. 한쪽이 crash 후 재부팅 → 새 연결 없는 상태에서 상대 ACK 수신 → RST
# 3. SO_LINGER(l_onoff=1, l_linger=0) 소켓 옵션으로 강제 RST
# 4. 방화벽이 연결 차단 시 RST 주입

# ss 명령으로 상태 확인
ss -tn state time-wait
ss -tn state close-wait
```

## TIME_WAIT 과다 문제와 해결

서버가 Active Close를 많이 하는 경우(HTTP/1.0, 단기 연결) TIME_WAIT 소켓이 쌓인다. 포트 고갈로 이어질 수 있다.

```bash
# TIME_WAIT 수 확인
ss -s | grep TIME-WAIT

# 완화 옵션 (서버 측에서만 권장)
# tcp_tw_reuse: TIME_WAIT 소켓을 새 연결에 재사용 (클라이언트 포트 재사용)
sysctl -w net.ipv4.tcp_tw_reuse=1

# SO_REUSEADDR: 같은 포트를 TIME_WAIT 상태에서도 bind 가능
# (서버 재시작 시 "Address already in use" 오류 방지)
int opt = 1;
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
```

`tcp_tw_recycle`은 NAT 환경에서 패킷 드롭을 유발하므로 Linux 4.12에서 제거됐다. `tcp_tw_reuse`는 클라이언트(Outbound) 연결에만 안전하다.

---

**지난 글:** [TCP 3-way 핸드셰이크: 연결 수립의 모든 것](/posts/network-tcp-3way-handshake/)

**다음 글:** [TCP 상태 머신: 11가지 상태와 전이 완전 해부](/posts/network-tcp-state-machine/)

<br>
읽어주셔서 감사합니다. 😊
