---
title: "TCP 3-way 핸드셰이크: 연결 수립의 모든 것"
description: "TCP 연결 수립 과정인 3-way 핸드셰이크(SYN→SYN+ACK→ACK)를 ISN 교환, 상태 전이, 보안 이슈까지 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "Network"
tags: ["TCP", "3way핸드셰이크", "SYN", "ISN", "연결수립", "SYN_SENT", "ESTABLISHED"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-vs-udp/)에서 TCP와 UDP의 핵심 차이를 살펴봤다. TCP가 신뢰성을 보장하는 출발점은 바로 **3-way 핸드셰이크**다. 데이터를 한 바이트도 보내기 전에 양측이 세 번의 메시지를 교환해 연결을 수립한다. 이 과정에서 초기 순서 번호(ISN)를 협상하고, 이후 재전송·흐름 제어의 기준이 될 상태를 초기화한다.

## 왜 3번인가? 2번으로는 부족하다

2-way 핸드셰이크는 클라이언트가 서버의 수신 가능 여부만 확인하지만, **서버가 클라이언트에게 도달할 수 있는지**는 알 수 없다. 3번째 메시지(클라이언트 ACK)가 있어야 서버 측도 "내가 보낸 SYN+ACK이 클라이언트에게 도달했고, 클라이언트가 이 연결을 원한다"는 사실을 확인한다. 또한 양방향 채널 각각에 독립적인 ISN을 설정해야 하므로 최소 3개의 메시지가 필요하다.

```text
ISN(Initial Sequence Number)을 양방향으로 교환하는 이유
────────────────────────────────────────────────────────
• 클라이언트 → 서버 방향: ISN_c 선언 (SYN에 포함)
• 서버 → 클라이언트 방향: ISN_s 선언 (SYN+ACK에 포함)
• 두 방향이 독립적 seq 공간을 가짐 → 재조립 충돌 방지
• ISN은 랜덤값 → 이전 연결의 지연 패킷과 혼동 방지
```

## 핸드셰이크 상세 흐름

![TCP 3-way 핸드셰이크](/assets/posts/network-tcp-3way-handshake-flow.svg)

세 단계를 정확히 보면 다음과 같다.

1. **SYN** — 클라이언트가 ISN_c(예: 1000)를 담은 SYN 세그먼트를 전송. 상태: `CLOSED → SYN_SENT`
2. **SYN+ACK** — 서버가 ISN_s(예: 5000)와 `ack=ISN_c+1(1001)`을 담아 응답. 상태: `LISTEN → SYN_RCVD`
3. **ACK** — 클라이언트가 `ack=ISN_s+1(5001)`을 전송. 양측 상태: `ESTABLISHED`

```bash
# tcpdump로 실제 3-way 핸드셰이크 관찰
sudo tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn|tcp-ack) != 0' -n

# 출력 예시
# 10:00:00.001 IP client.54321 > server.443: Flags [S],  seq 1000
# 10:00:00.010 IP server.443  > client.54321: Flags [S.], seq 5000, ack 1001
# 10:00:00.011 IP client.54321 > server.443: Flags [.],  ack 5001
```

## 상태 전이와 ISN

![핸드셰이크 상태 전이](/assets/posts/network-tcp-3way-handshake-states.svg)

`ack` 값이 상대방 `seq + 1`인 이유는 ACK 번호가 **"다음에 받기를 기대하는 바이트 번호"**이기 때문이다. SYN 세그먼트 자체는 데이터가 없지만 1바이트를 소비한 것으로 처리한다(FIN도 동일).

## SYN 큐와 Accept 큐

서버는 SYN을 받으면 해당 연결 정보를 **SYN 큐**(반연결 큐, backlog)에 넣고 SYN+ACK을 보낸다. 이후 클라이언트의 ACK이 도착하면 **Accept 큐**(완전연결 큐)로 이동한다. `accept()` 시스템 콜은 Accept 큐에서 완성된 연결을 꺼낸다.

```text
SYN 큐 한계치: /proc/sys/net/ipv4/tcp_max_syn_backlog
Accept 큐 한계치: listen(sockfd, backlog) 의 backlog 값

SYN Flood 공격: SYN만 보내고 ACK 안 보냄 → SYN 큐 포화
  대응: SYN Cookie (ACK 검증 후에야 큐 사용)
```

## SYN Flood와 SYN Cookie

SYN Flood 공격은 위조된 소스 IP로 대량 SYN을 보내 SYN 큐를 가득 채운다. SYN Cookie는 SYN 큐에 상태를 저장하지 않고, 쿠키값(암호화된 해시)을 SEQ에 담아 SYN+ACK을 보낸다. 합법적인 ACK이 도착하면 쿠키를 검증해 연결을 수립한다.

```bash
# SYN Cookie 활성화 확인
cat /proc/sys/net/ipv4/tcp_syncookies
# 1 = 활성화 (대부분 기본값)
```

## 핸드셰이크 RTT 비용

3-way 핸드셰이크는 데이터 전송 전에 **1.5 RTT**를 소비한다. TLS 1.3과 TCP Fast Open(TFO)은 이 비용을 줄이기 위해 핸드셰이크와 데이터 전송을 병합한다. QUIC(HTTP/3)은 아예 0-RTT 연결 재개를 지원한다.

---

**지난 글:** [TCP vs UDP: 신뢰성과 속도의 트레이드오프](/posts/network-tcp-vs-udp/)

**다음 글:** [TCP 연결 종료: 4-way 핸드셰이크와 Half-close](/posts/network-tcp-connection-termination/)

<br>
읽어주셔서 감사합니다. 😊
