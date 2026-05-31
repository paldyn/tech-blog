---
title: "신호와 인코딩: 데이터를 전파로 바꾸는 법"
description: "디지털 데이터가 물리 매체를 통해 전달되는 과정, NRZ·맨체스터·4B/5B 인코딩 방식, 아날로그 변조(QAM), Shannon 용량 정리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "Network"
tags: ["신호인코딩", "NRZ", "맨체스터인코딩", "4B5B", "QAM", "Shannon", "물리계층"]
featured: false
draft: false
---

[지난 글](/posts/network-circuit-vs-packet-switching/)에서 패킷이 네트워크를 통해 전달되는 교환 방식을 살펴봤다. 이번에는 한 단계 더 아래로 내려가 **비트(0과 1)가 실제 물리 신호로 변환되는 방법**을 살펴본다. 물리 계층에서 어떤 인코딩 방식을 쓰느냐에 따라 클럭 동기화 능력, 대역폭 효율, 에러 감지 능력이 달라진다.

## 신호의 기본 개념

물리 계층에서 데이터는 **전압(유선), 빛(광섬유), 전파(무선)** 형태로 전달된다. 중요한 것은 이 신호가 **연속적인 아날로그 파형**인 반면, 우리가 전달하려는 데이터는 **이산적인 디지털 비트**라는 점이다.

```
디지털 데이터:  1  0  1  1  0  0  1
                ↓  (인코딩)
물리 신호:  +V  0  +V  +V  0  0  +V  (전압 변화)
```

**주파수(Frequency)**는 초당 신호 변화 횟수(Hz), **대역폭(Bandwidth)**은 신호가 사용하는 주파수 범위다. 채널 대역폭이 넓을수록 단위 시간에 더 많은 데이터를 전송할 수 있다.

## 디지털 인코딩 방식

![디지털 인코딩 비교](/assets/posts/network-signaling-encoding-methods.svg)

### NRZ-L (Non-Return-to-Zero Level)

가장 단순한 인코딩이다. 1을 높은 전압(+V), 0을 낮은 전압(0 또는 -V)으로 표현한다.

```
비트:   1    0    1    1    0    0    1
NRZ-L: ___  ___  ___  ___
      +V  |     |+V |+V |   +V
          |_____|   |   |_____|
           0    0       0    0
```

**문제**: 연속된 0 또는 1이 길면 전압이 변하지 않아 수신측에서 클럭을 잃어버린다(DC drift). 긴 데이터 스트림에서는 사용하기 어렵다.

### 맨체스터 인코딩 (Manchester Encoding)

각 비트 구간의 **중앙에서 전압 전이**가 일어난다. 1은 하강(High→Low), 0은 상승(Low→High)으로 표현한다. IEEE 802.3 이더넷(10BASE-T, 10BASE5)이 사용한다.

```python
def manchester_encode(bits: list[int]) -> list[str]:
    """맨체스터 인코딩: 1=하강전이, 0=상승전이"""
    result = []
    for bit in bits:
        if bit == 1:
            result.append("H→L")  # 1: High to Low
        else:
            result.append("L→H")  # 0: Low to High
    return result

encoded = manchester_encode([1, 0, 1, 1, 0])
print(encoded)  # ['H→L', 'L→H', 'H→L', 'H→L', 'L→H']
```

**장점**: 각 비트마다 전이가 발생하므로 클럭이 신호에 내장된다. 수신측이 클럭을 별도로 동기화할 필요 없다.  
**단점**: 하나의 비트를 표현하는 데 신호 전이가 2번 필요하므로 **대역폭이 2배** 소모된다.

### 4B/5B 인코딩

100 Mbps Fast Ethernet(100BASE-TX)이 사용하는 방식이다. 4비트 데이터를 5비트 코드워드로 매핑해 전송한다. 32개 5비트 패턴(2⁵) 중 16개(2⁴)만 사용하며, 사용되지 않는 나머지는 프레임 경계나 오류 감지에 활용된다.

```python
# 4B/5B 인코딩 테이블 (부분)
ENCODING_TABLE = {
    0b0000: 0b11110,  # 0x0 → 11110
    0b0001: 0b01001,  # 0x1 → 01001
    0b0010: 0b10100,  # 0x2 → 10100
    0b0011: 0b10101,  # 0x3 → 10101
    0b0100: 0b01010,  # 0x4 → 01010
    0b0101: 0b01011,  # 0x5 → 01011
    0b1110: 0b11100,  # 0xE → 11100
    0b1111: 0b11101,  # 0xF → 11101
}

DECODING_TABLE = {v: k for k, v in ENCODING_TABLE.items()}

def encode_4b5b(nibble: int) -> int:
    """4비트 → 5비트 변환"""
    return ENCODING_TABLE[nibble & 0xF]

def decode_4b5b(code: int) -> int | None:
    """5비트 → 4비트 역변환 (유효하지 않으면 None)"""
    return DECODING_TABLE.get(code)
```

**핵심**: 5비트 코드워드는 연속된 0이 최대 3개로 제한된다. 이를 NRZ-I(차동 인코딩)와 결합하면 클럭 동기화가 보장된다. 오버헤드는 25%(4/5 = 80% 효율)지만 맨체스터의 50%보다 훨씬 효율적이다.

## 아날로그 변조

광케이블이나 이더넷처럼 디지털 신호를 직접 보낼 수 없는 매체(전화선, 무선)는 **아날로그 반송파(Carrier)**에 디지털 데이터를 실어 보낸다.

![아날로그 변조와 Shannon](/assets/posts/network-signaling-encoding-layers.svg)

```
변조 방식 비교:
ASK  (진폭 편이): 1 = 높은 진폭, 0 = 낮은 진폭  → 잡음에 약함
FSK  (주파수 편이): 1 = 높은 주파수, 0 = 낮은 주파수  → 잡음에 강함
PSK  (위상 편이): 1 = 0°, 0 = 180°  → 조밀한 부호화
QAM  (직교 진폭): 진폭 + 위상 동시 변조  → 가장 효율적
```

Wi-Fi 6E와 Wi-Fi 7은 **4096-QAM**을 사용한다. 하나의 심볼로 log₂(4096) = 12비트를 동시에 전송한다.

```python
import math

def qam_bits_per_symbol(m: int) -> int:
    """M-QAM에서 심볼당 비트 수 계산"""
    return int(math.log2(m))

for m in [4, 16, 64, 256, 1024, 4096]:
    bps = qam_bits_per_symbol(m)
    print(f"{m}-QAM: {bps} bits/symbol")
# 4-QAM:    2 bits/symbol  (Wi-Fi 1/2)
# 64-QAM:   6 bits/symbol  (Wi-Fi 5)
# 256-QAM:  8 bits/symbol  (Wi-Fi 6)
# 1024-QAM: 10 bits/symbol (Wi-Fi 6E)
# 4096-QAM: 12 bits/symbol (Wi-Fi 7)
```

## Shannon의 채널 용량 정리

어떤 채널이든 이론적 최대 전송 속도는 **Shannon의 정리**로 결정된다.

```
C = B × log₂(1 + S/N)

C: 채널 용량 (bps)
B: 채널 대역폭 (Hz)
S/N: 신호 대 잡음비 (선형값)
```

```python
def shannon_capacity(bandwidth_hz: float, snr_db: float) -> float:
    """Shannon 채널 용량 계산"""
    snr_linear = 10 ** (snr_db / 10)
    capacity_bps = bandwidth_hz * math.log2(1 + snr_linear)
    return capacity_bps

# 예: 5GHz Wi-Fi 채널 80MHz, SNR 30dB
capacity = shannon_capacity(80e6, 30)
print(f"이론적 최대: {capacity / 1e6:.1f} Mbps")
# → 이론적 최대: 798.0 Mbps

# SNR이 낮아지면 용량 급감
for snr in [30, 20, 10, 3]:
    cap = shannon_capacity(80e6, snr) / 1e6
    print(f"SNR {snr:2d}dB → {cap:6.1f} Mbps")
# SNR 30dB → 798.0 Mbps
# SNR 20dB → 532.4 Mbps
# SNR 10dB → 266.2 Mbps
# SNR  3dB → 127.0 Mbps
```

실제 Wi-Fi 속도가 이론값에 못 미치는 이유는 프로토콜 오버헤드, 간섭, 레트라이 등 여러 요인 때문이다.

## 정리

디지털 데이터가 물리 신호로 변환될 때 세 가지 핵심 문제를 해결해야 한다.

1. **클럭 동기화**: 맨체스터나 4B/5B처럼 신호에 클럭 정보를 내장
2. **대역폭 효율**: NRZ계열이 효율적이지만 동기화 어려움
3. **잡음 저항**: SNR이 높아야 고차 QAM 적용 가능

현대 이더넷(10GBASE-T)은 4D-PAM5라는 5레벨 신호를 사용하고, Wi-Fi는 OFDM + QAM 조합으로 스펙트럼 효율을 극대화하고 있다.

---

**지난 글:** [회선 교환 vs 패킷 교환](/posts/network-circuit-vs-packet-switching/)

**다음 글:** [오류 감지와 CRC](/posts/network-error-detection-crc/)

<br>
읽어주셔서 감사합니다. 😊
