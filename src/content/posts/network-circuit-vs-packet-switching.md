---
title: "회선 교환 vs 패킷 교환: 인터넷의 근본 원리"
description: "회선 교환(Circuit Switching)과 패킷 교환(Packet Switching)의 동작 원리, Store-and-Forward, 장단점 비교를 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["회선교환", "패킷교환", "CircuitSwitching", "PacketSwitching", "Store-and-Forward", "인터넷원리"]
featured: false
draft: false
---

[지난 글](/posts/network-rtt-jitter/)에서 RTT와 지터가 실시간 서비스 품질을 결정하는 핵심 지표임을 살펴봤다. 이번 글에서는 한 발짝 더 물러서서, 네트워크가 데이터를 전달하는 두 가지 근본적인 패러다임인 **회선 교환**과 **패킷 교환**을 비교한다. 이 두 방식의 선택이 인터넷의 설계 철학 자체를 결정했다.

## 회선 교환 (Circuit Switching)

전통적인 전화망(PSTN)이 채택한 방식이다. 통화 전 송신자와 수신자 사이에 **전용 경로(Circuit)**를 사전에 예약하고, 통화가 끝날 때까지 그 경로를 독점 사용한다.

![회선 교환 vs 패킷 교환](/assets/posts/network-circuit-vs-packet-switching-circuit.svg)

**3단계 동작**:
1. **연결 수립(Call Setup)**: 경로상 모든 스위치가 전용 자원을 할당
2. **데이터 전송**: 예약된 경로로 일정한 대역폭 보장
3. **연결 해제(Teardown)**: 경로 해제, 자원 반납

장점은 **일정한 품질 보장(QoS)**이다. 예약된 대역폭이 항상 사용 가능하므로 전화 통화처럼 지연 변동이 없어야 하는 서비스에 적합했다. 단점은 **자원 낭비**다. 아무 말도 안 하는 동안(침묵 구간)에도 회선이 점유된다.

```text
회선 교환 비효율 예시:
- 전화 통화 중 50%가 침묵 구간
- 회선은 100% 내내 점유
- 실제 활용률: ~50%
```

## 패킷 교환 (Packet Switching)

인터넷이 채택한 방식이다. 데이터를 **패킷(Packet)**이라는 작은 단위로 분할해 전송한다. 각 패킷은 독립적으로 최적 경로를 찾아가며, 라우터는 들어온 패킷을 저장(Store)하고 다음 홉으로 전달(Forward)한다.

![패킷 교환 Store-and-Forward](/assets/posts/network-circuit-vs-packet-switching-packet.svg)

**Store-and-Forward** 동작: 라우터는 패킷 전체를 수신 완료한 후에야 다음 링크로 전송한다. 이 때문에 각 홉에서 `패킷크기 ÷ 링크속도`만큼의 전송 지연이 발생한다.

```text
# Store-and-Forward 지연 계산
패킷 크기: 1,500 bytes = 12,000 bits
링크 속도: 100 Mbps

전송 지연 per hop = 12,000 / 100,000,000 = 0.12 ms
홉 수 3개 → 총 전송 지연 ≈ 0.36 ms (무시할 수준)
```

장점은 **자원 공유**와 **확장성**이다. 여러 흐름의 패킷이 같은 링크를 나눠 쓰기 때문에 전체 효율이 훨씬 높다. 단점은 **지연 변동(지터)**이다. 혼잡 시 큐에 쌓인 패킷이 늘어나 지연이 예측 불가능해진다.

## 두 방식의 멀티플렉싱

```text
회선 교환의 멀티플렉싱:
TDM (Time Division Multiplexing) — 시간 슬롯 고정 할당
FDM (Frequency Division Multiplexing) — 주파수 대역 고정 할당
→ 특정 흐름에 슬롯/대역 예약 → 예측 가능하지만 비효율

패킷 교환의 멀티플렉싱:
Statistical Multiplexing — 패킷 단위 동적 공유
→ 유휴 대역폭을 다른 흐름이 즉시 사용 → 효율적이지만 혼잡 가능
```

## 현대의 절충: VoIP와 QoS

순수 패킷 교환 네트워크에서 실시간 서비스를 돌리는 해법이 **QoS(Quality of Service)**다. DiffServ, DSCP 마킹으로 음성·화상 트래픽에 높은 우선순위를 부여해, 실질적으로 회선 교환에 가까운 품질을 보장한다.

```bash
# Linux에서 tc(traffic control)로 QoS 설정 예시
# VoIP(포트 5060) 트래픽 우선 처리
tc qdisc add dev eth0 root handle 1: prio
tc filter add dev eth0 parent 1: protocol ip \
   u32 match ip dport 5060 0xffff flowid 1:1
```

패킷 교환이 인터넷을 만들었다면, QoS가 인터넷 위에서 전화를 가능하게 했다. 다음 글에서는 이 모든 통신의 물리적 기반인 신호와 인코딩을 살펴본다.

---

**지난 글:** [RTT와 지터: 지연 변동성 이해하기](/posts/network-rtt-jitter/)

**다음 글:** [신호와 인코딩: 비트를 전기 신호로 바꾸는 방법](/posts/network-signaling-encoding/)

<br>
읽어주셔서 감사합니다. 😊
