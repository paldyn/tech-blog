---
title: "신호와 인코딩: 비트가 물리 세계로 나가는 방법"
description: "디지털 데이터를 물리 신호로 변환하는 인코딩 방식(NRZ, Manchester, 4B/5B, 8B/10B)과 아날로그 변조(ASK/FSK/PSK/QAM)를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["신호인코딩", "Manchester", "4B5B", "QAM", "물리계층", "변조방식"]
featured: false
draft: false
---

[지난 글](/posts/network-circuit-vs-packet-switching/)에서 패킷 교환의 동작 원리를 살펴봤다. 이번 글에서는 OSI 1계층(물리 계층)의 핵심인 **신호(Signal)와 인코딩(Encoding)**을 다룬다. 컴퓨터 내부의 0과 1이 어떻게 케이블·전파를 통해 전달되는지 이해하면 네트워크 성능과 장애의 물리적 근거를 파악할 수 있다.

## 신호의 기본 개념

물리 계층에서 데이터는 **신호(Signal)**로 전달된다. 신호는 시간에 따른 물리량(전압, 전류, 빛의 세기, 전파 주파수)의 변화다.

```
신호 분류:
  아날로그 신호: 연속적인 값 (전통 전화, AM/FM 라디오)
  디지털 신호: 불연속적인 값 (0/1, 컴퓨터 데이터)

주요 특성:
  주파수(Frequency): 초당 사이클 수 (Hz)
  진폭(Amplitude): 신호 최대 세기
  위상(Phase): 기준점 대비 시작 위치
  파장(Wavelength): 한 사이클의 물리적 길이
```

## 대역폭과 나이퀴스트·샤논 정리

**나이퀴스트(Nyquist) 정리**는 잡음 없는 채널의 최대 전송률을 정의한다.

```
나이퀴스트 공식:
  최대 비트율 = 2 × 대역폭(Hz) × log₂(신호 레벨 수)

  예: 대역폭 3000Hz, 2레벨(0/1) 신호
  최대 비트율 = 2 × 3000 × log₂(2) = 6000 bps

샤논(Shannon) 공식 (잡음 고려):
  채널 용량 = 대역폭 × log₂(1 + S/N)
  S/N: 신호 대 잡음 비율 (Signal-to-Noise Ratio)

  예: 3000Hz 대역폭, SNR = 30dB (1000:1)
  채널 용량 = 3000 × log₂(1001) ≈ 30,000 bps
```

## 디지털 인코딩 방식

![디지털 인코딩 방식](/assets/posts/network-signaling-encoding-types.svg)

### NRZ-L (Non-Return-to-Zero Level)

가장 단순한 방식. 0은 낮은 전압, 1은 높은 전압으로 표현한다.

```
비트:    0  1  0  0  1  1  0  1
전압: L  H     L  L     H  H  L  H
```

**단점**: 연속된 같은 비트(000... 또는 111...)는 전압이 변하지 않아 수신 측이 클럭을 잃기 쉽다. 또 DC 성분이 있어 장거리 전송에 부적합하다.

### Manchester Encoding

각 비트 중간에 전압 전환이 일어난다. 0은 H→L, 1은 L→H 전환으로 표현한다.

```
비트:     0      1
신호:  H→L    L→H
클럭:  내장 (동기화 자동)
```

**장점**: 클럭이 데이터에 내장되어 자기 동기화(self-clocking)가 가능하다. 이더넷 10BASE-T가 사용한다.  
**단점**: 대역폭 사용량이 NRZ의 2배.

### 4B/5B 인코딩

4비트 데이터를 5비트 코드로 매핑한다. 5비트 코드는 연속 0이 3개를 초과하지 않도록 설계되어 있어 동기화가 쉽다.

```python
# 4B/5B 매핑 테이블 일부
b4_to_b5 = {
    '0000': '11110',
    '0001': '01001',
    '0010': '10100',
    '0011': '10101',
    '0100': '01010',
    '1111': '11101',
    # ...
}
```

100BASE-TX(Fast Ethernet)에서 4B/5B + NRZI 조합으로 사용된다. 오버헤드는 25%.

### 8B/10B 인코딩

8비트를 10비트로 매핑. DC 균형(0과 1의 수가 비슷)을 유지하고 동기화를 보장한다.

```
기가비트 이더넷(1000BASE-T), SATA, PCIe에서 사용
오버헤드: 25%
이점: DC 균형 → 광섬유/동축 케이블에서 신호 품질 향상
```

## 아날로그 변조 방식

디지털 데이터를 아날로그 캐리어(반송파) 신호에 실을 때는 변조(Modulation)를 사용한다. Wi-Fi, 모뎀, 5G에서 핵심 기술이다.

![아날로그 변조 방식](/assets/posts/network-signaling-encoding-modulation.svg)

### QAM (Quadrature Amplitude Modulation)

진폭과 위상을 동시에 변조해 심볼당 더 많은 비트를 전송한다.

```
QAM 레벨별 효율:
  QAM-4   (QPSK):   2 bits/심볼  → Wi-Fi 기본
  QAM-16:           4 bits/심볼  → Wi-Fi 4
  QAM-64:           6 bits/심볼  → Wi-Fi 5 (good SNR)
  QAM-256:          8 bits/심볼  → Wi-Fi 5 (excellent SNR)
  QAM-1024:        10 bits/심볼  → Wi-Fi 6
  QAM-4096:        12 bits/심볼  → Wi-Fi 7

높은 QAM일수록:
  → 더 많은 데이터 전송 가능 (대역폭 효율 ↑)
  → 신호 구분이 어려워져 높은 SNR 필요
  → 거리가 멀거나 잡음이 많으면 낮은 QAM으로 자동 조정
```

## OFDM: 멀티캐리어 전송

현대 Wi-Fi와 LTE/5G는 **OFDM(Orthogonal Frequency Division Multiplexing)**을 사용한다.

```
OFDM 원리:
  1. 넓은 대역폭을 수백~수천 개의 좁은 서브캐리어로 분할
  2. 각 서브캐리어에 독립적으로 QAM 변조
  3. 주파수 선택적 페이딩(multipath fading)에 강함

Wi-Fi 6 (802.11ax):
  서브캐리어 간격: 78.125 kHz
  FFT 크기: 1024 포인트
  심볼당 최대 10 bits (QAM-1024)
  총 최대 속도: 9.6 Gbps (이론값)
```

## 클럭 복원과 동기화

수신 측은 수신한 신호에서 **클럭(Clock)**을 복원해야 비트 경계를 정확히 알 수 있다.

```
동기화 방식:
  ① 별도 클럭 라인 (단거리, 예: SPI)
  ② 자기 동기화 인코딩 (Manchester, 8B/10B)
     → 전압 전환이 클럭 역할
  ③ PLL (Phase-Locked Loop) 회로
     → 수신 신호의 전환 패턴에서 클럭 추출
```

이더넷이 Manchester 인코딩(10Mbps)에서 4B/5B+NRZI(100Mbps), 8B/10B(1Gbps)로 발전한 것도 고속에서 클럭 동기화를 유지하면서 오버헤드를 줄이기 위한 진화였다.

---

**지난 글:** [회선 교환 vs 패킷 교환](/posts/network-circuit-vs-packet-switching/)

**다음 글:** [오류 감지와 CRC](/posts/network-error-detection-crc/)

<br>
읽어주셔서 감사합니다. 😊
