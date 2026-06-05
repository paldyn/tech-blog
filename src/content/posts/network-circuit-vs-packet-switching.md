---
title: "회선 교환 vs 패킷 교환: 인터넷이 패킷을 선택한 이유"
description: "회선 교환(Circuit Switching)과 패킷 교환(Packet Switching)의 동작 원리, 장단점, 통계적 다중화 개념, Store-and-Forward 방식을 비교 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["회선교환", "패킷교환", "통계적다중화", "StoreAndForward", "PSTN", "인터넷"]
featured: false
draft: false
---

[지난 글](/posts/network-rtt-jitter/)에서 RTT와 지터를 살펴봤다. 이번 글에서는 네트워크가 데이터를 전달하는 두 가지 근본적인 방식인 **회선 교환(Circuit Switching)**과 **패킷 교환(Packet Switching)**을 비교한다. 인터넷이 왜 패킷 교환을 선택했는지 이해하면 네트워크 설계의 철학이 보인다.

## 회선 교환 (Circuit Switching)

회선 교환은 **통신 전에 출발지에서 목적지까지 전용 경로(회선)를 예약**하고, 통신이 끝날 때까지 그 경로를 독점하는 방식이다.

![회선 교환 vs 패킷 교환](/assets/posts/network-circuit-vs-packet-switching-compare.svg)

우리가 아는 전통 **PSTN(Public Switched Telephone Network)** 전화망이 대표적이다. 전화를 걸면 교환기가 상대방까지의 경로를 확보하고, 통화 내내 그 경로를 유지한다.

```
회선 교환 동작 순서:
1. 연결 설정 (Connection Setup)
   → 출발지~목적지 경로의 모든 스위치에 자원 예약
   → 대역폭의 특정 슬롯(TDM) 또는 주파수(FDM) 할당

2. 데이터 전송
   → 예약된 전용 경로로만 전송
   → 지연시간 일정, QoS 보장
   → 데이터가 없어도(침묵) 슬롯 점유

3. 연결 해제
   → 예약 자원 반납
```

**장점**: 지연시간 예측 가능, 일정한 QoS  
**단점**: 유휴 시간에도 자원 낭비, 연결 수 한계, 설정 시간(call setup delay)

## 패킷 교환 (Packet Switching)

패킷 교환은 **데이터를 패킷 단위로 쪼개 각각 독립적으로 전달**하는 방식이다. 전용 경로를 예약하지 않고, 각 패킷이 네트워크 상황에 따라 다른 경로를 택할 수 있다.

```
패킷 교환 동작:
  [전체 데이터]
       ↓ 분할
  [패킷1 | 헤더(IP)] → 라우터A → 라우터B → 목적지
  [패킷2 | 헤더(IP)] → 라우터A → 라우터C → 목적지 (다른 경로 가능)
  [패킷3 | 헤더(IP)] → 라우터B → 목적지 (순서 바뀔 수 있음)
       ↓ 재조립
  [전체 데이터 복원]
```

![통계적 다중화](/assets/posts/network-circuit-vs-packet-switching-mux.svg)

## Store-and-Forward

패킷 교환 라우터의 핵심 동작은 **Store-and-Forward**다. 패킷 전체를 수신한 뒤, 오류를 확인하고, 다음 홉으로 전달한다.

```python
# Store-and-Forward 의사 코드
def router_forward(incoming_packet):
    # 1. Store: 패킷 전체를 버퍼에 저장
    buffer.store(incoming_packet)
    
    # 2. 오류 검증 (FCS/CRC)
    if not verify_checksum(incoming_packet):
        drop(incoming_packet)
        return
    
    # 3. IP 헤더 파싱
    dst_ip = incoming_packet.ip_header.dst
    
    # 4. 라우팅 테이블 조회
    next_hop = routing_table.lookup(dst_ip)
    
    # 5. Forward: 다음 홉으로 전달
    output_queue[next_hop].enqueue(incoming_packet)
```

Store-and-Forward 지연:
```
전송 지연 = (패킷 크기) / (링크 대역폭)
총 전송 지연 = N홉 × (패킷 크기 / 대역폭)  # 직렬화 지연
```

## 통계적 다중화 (Statistical Multiplexing)

패킷 교환의 핵심 강점은 **통계적 다중화**다. 여러 사용자가 링크를 공유하되, 전통적인 TDM(시분할)처럼 고정된 슬롯을 할당하는 대신, **필요한 시점에만 링크를 사용**한다.

```
TDM (회선 교환):
  시간: [A][B][C][A][B 빈][C][A]...
        ↑ B가 침묵해도 슬롯 낭비

통계적 다중화 (패킷 교환):
  시간: [A:p1][B:p1][A:p2][C:p1][B:p2][C:p2]...
        ↑ 빈 슬롯 없이 링크 최대 활용
```

이 덕분에 1Gbps 링크에 수백 개의 사용자가 동시에 접속해도, 각자가 전체 대역폭을 burst해서 사용할 수 있다. 대신 모두가 동시에 burst하면 혼잡(congestion)이 발생한다.

## 가상 회선 (Virtual Circuit)

두 방식의 중간 형태로 **가상 회선(Virtual Circuit)**이 있다. ATM(Asynchronous Transfer Mode)이나 MPLS가 이 방식을 사용한다.

```
가상 회선 특징:
- 연결 설정 시 경로를 미리 결정 (회선 교환과 유사)
- 하지만 자원을 물리적으로 점유하지 않음 (패킷 교환과 유사)
- 각 패킷에 작은 VCI(Virtual Circuit Identifier)만 붙임
- 경로 일관성 + 패킷 순서 보장

MPLS Label Switching:
  패킷 헤더 대신 짧은 레이블로 라우팅 → 고속 처리
  ISP 백본에서 QoS 보장에 활용
```

## 왜 인터넷은 패킷 교환을 선택했는가

ARPANET 설계자들은 회선 교환이 군사 목적에 취약하다고 판단했다. 특정 경로가 끊겨도 다른 경로로 자동 우회할 수 있는 **견고성(resilience)**을 원했기 때문이다.

```
패킷 교환을 선택한 이유:
1. 경로 장애 시 자동 우회 가능
2. 자원을 여러 사용자가 공유 → 비용 절감
3. 버스트 트래픽에 적합 (웹, 파일 전송)
4. 새 기술 추가 시 기존 인프라 변경 최소화
```

오늘날 5G에서는 실시간성이 필요한 슬라이스(slice)에 QoS를 적용해 회선 교환의 특성을 패킷 네트워크 위에 구현하고 있다.

---

**지난 글:** [RTT와 지터](/posts/network-rtt-jitter/)

**다음 글:** [신호와 인코딩](/posts/network-signaling-encoding/)

<br>
읽어주셔서 감사합니다. 😊
