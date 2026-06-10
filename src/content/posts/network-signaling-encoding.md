---
title: "신호와 인코딩: 비트가 전선을 타는 방법"
description: "디지털 신호의 기초, NRZ·Manchester·4B/5B·8B/10B·PAM4 인코딩 방식의 원리와 사용처, 클록 동기화 문제를 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["신호인코딩", "NRZ", "Manchester", "4B5B", "8B10B", "PAM4", "물리계층"]
featured: false
draft: false
---

[지난 글](/posts/network-circuit-vs-packet-switching/)에서 패킷 교환이 어떻게 동작하는지 살펴봤다. 패킷이 링크를 통해 이동할 때, 컴퓨터가 이해하는 이진수 0과 1은 실제로 어떻게 전기 신호로 바뀌는가? 이것이 OSI 1계층, 물리 계층이 다루는 핵심 문제다.

## 디지털 신호의 기초

디지털 신호는 이산적인 전압 레벨로 비트를 표현한다. 가장 단순한 방법은 1=고전압, 0=저전압으로 약속하는 것이다. 그러나 이 단순한 방법에는 두 가지 문제가 있다.

1. **연속 같은 비트 문제**: `000000`이 계속되면 신호 변화가 없어 수신측이 클록을 맞추기 어렵다.
2. **DC 편향(DC bias)**: 긴 1 스트림이 평균 전압을 높여 AC 결합 링크에서 문제를 일으킨다.

이를 해결하기 위해 다양한 **라인 인코딩(Line Encoding)** 방식이 개발됐다.

![디지털 신호 인코딩 방식](/assets/posts/network-signaling-encoding-types.svg)

## NRZ (Non-Return-to-Zero)

가장 단순한 인코딩이다. 1=고전압, 0=저전압을 유지하며, 비트 사이에 0V로 복귀하지 않는다.

```text
데이터: 1  0  1  1  0  0  1
신호:  +V -V +V +V -V -V +V
```

단순하지만 연속된 같은 비트에서 동기화 문제가 발생한다. 주로 짧은 거리 또는 추가 동기화 메커니즘이 있는 환경에서 쓰인다.

## Manchester 인코딩

각 비트 구간 **중앙에서 에지 전환**을 만들어 클록 정보를 데이터에 내포한다.

```text
1 = 구간 중앙에서 고→저 하강 에지
0 = 구간 중앙에서 저→고 상승 에지
```

에지가 항상 발생하므로 수신측이 클록을 잃지 않는다. 10BASE-T(10Mbps 이더넷)에서 사용됐다. 단점은 각 비트에 두 번의 신호 변화가 필요해 필요 대역폭이 NRZ의 두 배라는 점이다.

## 4B/5B + NRZI (Fast Ethernet)

100Mbps Fast Ethernet(100BASE-TX)에서 사용하는 방식이다.

```text
4B/5B: 4비트 데이터를 5비트 코드로 치환
       → 연속 0 비트 최대 3개로 제한 (클록 동기 보장)

NRZI(Non-Return-to-Zero Inverted): 1에서만 신호 전환
       → 5비트 코드와 결합해 DC 밸런스 유지
```

4비트 → 5비트 변환으로 오버헤드 25%가 발생한다. 물리 링크는 125Mbps로 동작해 사용자에게 100Mbps를 제공한다.

## 8B/10B (Gigabit Ethernet, Fibre Channel)

4B/5B의 진화형이다. 8비트를 10비트로 확장하며, 두 가지 목표를 달성한다.

- **런닝 디스패리티(Running Disparity)**: 누적된 1과 0의 차이를 추적해 DC 밸런스 유지
- **특수 심볼**: 프레임 구분자(Comma 문자)를 10비트 코드로 표현 가능

오버헤드 25%로 1Gbps 링크는 실제 1.25Gbps로 클록한다.

## PAM4 — 고속 인터페이스의 현재

NRZ가 400Gbps 이상에서 한계에 부딪히자 **PAM4(Pulse Amplitude Modulation 4-level)**가 등장했다.

![NRZ vs PAM4](/assets/posts/network-signaling-encoding-pam4.svg)

```text
NRZ:  2개 전압 레벨 → 1 bit/symbol
PAM4: 4개 전압 레벨 → 2 bit/symbol

PAM4 심볼-비트 매핑:
  +3V = 11
  +1V = 10
  -1V = 01
  -3V = 00
```

같은 클록 속도에서 PAM4는 NRZ의 **2배 데이터**를 전송한다. 400G 이더넷, PCIe 4.0/5.0, USB 4.0에서 사용된다. 대신 4개 레벨을 구분하려면 높은 신호 대 잡음비(SNR)가 필요해 전송 거리가 짧고 고품질 케이블이 필요하다.

## 아날로그 신호와 변조

전통적 전화망이나 DSL, 케이블TV 인프라에서 디지털 데이터를 아날로그 신호에 실으려면 **변조(Modulation)**가 필요하다.

```text
ASK (Amplitude Shift Keying): 진폭으로 비트 표현
FSK (Frequency Shift Keying): 주파수로 비트 표현
PSK (Phase Shift Keying):     위상으로 비트 표현
QAM (Quadrature AM):          진폭+위상 동시 변조 → 고효율
  → 802.11ac Wi-Fi: 256-QAM (8bit/symbol)
  → 802.11ax Wi-Fi: 1024-QAM (10bit/symbol)
```

인코딩과 변조를 이해하면 "왜 이 케이블로는 1Gbps가 안 되는가", "왜 Wi-Fi 6가 더 빠른가"에 대한 물리적 근거를 파악할 수 있다.

---

**지난 글:** [회선 교환 vs 패킷 교환](/posts/network-circuit-vs-packet-switching/)

**다음 글:** [오류 감지: CRC와 체크섬의 원리](/posts/network-error-detection-crc/)

<br>
읽어주셔서 감사합니다. 😊
