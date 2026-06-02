---
title: "TCP 순서 번호와 ACK: 신뢰성의 수학적 기반"
description: "TCP Sequence Number와 ACK의 누적 확인 방식, 재전송, SACK, DSACK, Fast Retransmit의 원리를 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["TCP", "순서번호", "ACK", "재전송", "SACK", "FastRetransmit", "CumulativeACK"]
featured: false
draft: false
---

[지난 글](/posts/network-tcp-time-wait/)에서 TIME_WAIT의 원리와 튜닝 방법을 살펴봤다. TCP 신뢰성의 핵심 메커니즘은 **순서 번호(Sequence Number)**와 **ACK(Acknowledgment Number)**다. 이 두 필드가 바이트 단위로 데이터의 전달 여부를 추적하고 재전송의 기준이 된다.

## 순서 번호와 ACK의 의미

TCP는 바이트 스트림을 다룬다. 각 세그먼트의 `seq` 필드는 **이 세그먼트의 첫 번째 바이트 번호**를 나타낸다. 수신자가 보내는 `ack` 필드는 **다음에 받기를 기대하는 바이트 번호**다.

```text
송신자: Seq=1000, Len=200 전송
  → bytes 1000, 1001, ..., 1199 포함

수신자: ACK=1200 응답
  → "1199까지 잘 받았고, 1200번째 바이트부터 보내줘"
  → Cumulative ACK: 1199 이하 모든 바이트 수신 확인

다음 세그먼트: Seq=1200, Len=300
  → bytes 1200~1499
```

## 순서 번호와 ACK 동작 시나리오

![TCP Seq/ACK 동작 원리](/assets/posts/network-tcp-sequence-ack-basics.svg)

세그먼트가 유실되면 수신자는 **Duplicate ACK**(같은 ACK 번호를 반복)을 보낸다. 송신자가 같은 ACK을 3번 받으면 **Fast Retransmit**을 실행해 RTO(재전송 타임아웃)를 기다리지 않고 즉시 재전송한다.

```bash
# tcpdump로 Dup-ACK 관찰
sudo tcpdump -i eth0 -nn 'tcp' -w /tmp/capture.pcap

# Wireshark에서 분석:
# [TCP Dup ACK 5#1] seq=1200, ack=1500 → Dup ACK 1번째
# [TCP Dup ACK 5#2] seq=1200, ack=1500 → 2번째
# [TCP Dup ACK 5#3] seq=1200, ack=1500 → 3번째 → Fast Retransmit 트리거
# [TCP Fast Retransmission] seq=1500, len=100
```

## Cumulative ACK의 한계와 SACK

기본 ACK 방식은 누적 확인(Cumulative ACK)이라 중간이 유실되면 이후 도착한 데이터를 확인해줄 수 없다.

![Cumulative ACK vs SACK](/assets/posts/network-tcp-sequence-ack-sack.svg)

SACK(Selective Acknowledgment)은 TCP 옵션 필드를 사용해 불연속적으로 수신된 범위를 알려준다. 최대 4개의 블록을 표현할 수 있으며, 송신자는 실제 유실된 범위만 재전송한다.

```text
SACK 블록 구조 (TCP 옵션 필드)
Kind=5, Length=10+8×n
┌─────────────────────────────────────┐
│ Kind(1) │ Len(1) │ Left1(4) │ Right1(4) │
│ Left2(4) │ Right2(4) │ ...             │
└─────────────────────────────────────┘

예: ACK=201, SACK={[301,500], [601,700]}
→ 201~300 유실, 501~600 유실
→ 나머지는 수신 완료
```

## DSACK: 중복 수신 알림

DSACK(Duplicate SACK, RFC 2883)은 이미 받은 데이터가 재전송됐을 때 이를 알린다. 불필요한 재전송을 줄이고 RTT 추정 정확도를 높이는 데 활용된다.

```bash
# SACK, DSACK 활성화 확인
sysctl net.ipv4.tcp_sack    # 1 = 활성화
sysctl net.ipv4.tcp_dsack   # 1 = 활성화

# 재전송 통계
netstat -s | grep -i retransmit
# Tcp: 42 segments retransmitted
```

## ISN 보안: 랜덤 초기화

초기 순서 번호(ISN)가 예측 가능하면 공격자가 연결을 탈취할 수 있다. Linux는 ISN을 암호학적으로 안전한 난수로 생성한다(RFC 6528). 이전 연결의 높은 SEQ가 새 연결과 충돌하지 않도록 TIME_WAIT(2MSL)와 함께 작동한다.

---

**지난 글:** [TCP TIME_WAIT 완전 정복: 왜 생기고 어떻게 다루는가](/posts/network-tcp-time-wait/)

**다음 글:** [TCP 흐름 제어: 수신 윈도우와 슬라이딩 윈도우](/posts/network-tcp-flow-control/)

<br>
읽어주셔서 감사합니다. 😊
