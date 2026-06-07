---
title: "신호와 인코딩: 비트를 전기 신호로 바꾸는 방법"
description: "디지털 신호 인코딩(NRZ, Manchester, NRZI)과 아날로그 변조(ASK, FSK, PSK, QAM) 방식, 그리고 현대 Wi-Fi·5G에서 사용하는 고차 변조를 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["신호인코딩", "NRZ", "Manchester", "QAM", "변조", "디지털신호", "물리계층"]
featured: false
draft: false
---

[지난 글](/posts/network-circuit-vs-packet-switching/)에서 패킷 교환이 인터넷의 근본 원리임을 살펴봤다. 패킷이 목적지로 가려면 결국 물리 매체를 통해 **신호(Signal)**로 전달돼야 한다. 이번 글에서는 0과 1이라는 디지털 데이터를 전선이나 공기를 통해 전달할 수 있는 신호로 바꾸는 방법, 즉 **인코딩(Encoding)**과 **변조(Modulation)**를 다룬다.

## 디지털 신호 인코딩

유선 환경에서 비트를 전압 수준으로 표현하는 방식이다. 선택 기준은 클록 동기화, DC 성분(직류 성분), 대역폭 효율성이다.

![디지털 신호 인코딩 방식 비교](/assets/posts/network-signaling-encoding-types.svg)

### NRZ-L (Non-Return to Zero Level)

가장 단순한 방식이다. `1 = 고전압`, `0 = 저전압`으로 표현한다.

```text
비트:   1  0  1  1  0  0  1  0
신호:  ─┐ └─ ┌─ ─  └─ ─  ┌─ └─

장점: 구현 간단
단점: - DC 성분 발생 (커패시터 연결 불가)
      - 연속 0/1에서 클록 동기화 어려움
사용: 초기 직렬 통신
```

### Manchester 인코딩 (이더넷 사용)

각 비트 중간에 반드시 전이(Transition)가 발생한다. `1 = 저→고 전이`, `0 = 고→저 전이`다.

```text
비트:   1     0     1     1
신호:  _┌─  ─┐_  _┌─  _┌─
       ↑     ↑     ↑     ↑
      중간 전이 → 클록 자동 동기화

장점: 자체 클록 동기화, DC 성분 없음
단점: 2배 대역폭 필요 (1Mbps 데이터 → 2MHz 신호)
사용: 10BASE-T 이더넷, RFID
```

### NRZI (Non-Return to Zero Inverted)

`1 = 현재 수준에서 전이`, `0 = 전이 없음`으로 표현한다.

```text
비트:  1  0  1  1  0  0  1
전이:  ↕  -  ↕  ↕  -  -  ↕
신호: ─┐ ┌─  ┐┌─ ┌─ ─── ┌─

장점: 연속 1은 동기화 가능, USB 채택
단점: 연속 0은 동기화 불가 → 비트 스터핑(Bit Stuffing) 필요
사용: USB, 광섬유(4B/5B 결합)
```

## 아날로그 변조 (Modulation)

무선 환경에서는 반송파(Carrier Wave) 위에 정보를 실어 나른다. 정현파의 세 가지 특성(진폭·주파수·위상)을 변화시켜 데이터를 표현한다.

![아날로그 변조 방식](/assets/posts/network-signaling-encoding-digital.svg)

| 방식 | 변화 요소 | 장단점 | 사용처 |
|------|-----------|--------|--------|
| ASK | 진폭 | 구현 간단, 잡음에 취약 | 광통신, 적외선 |
| FSK | 주파수 | 잡음에 강함, 대역폭 효율 낮음 | 모뎀, Bluetooth |
| PSK | 위상 | 효율적, 동기화 필요 | Wi-Fi, LTE |

### QAM: 현대 고속 통신의 핵심

**QAM(Quadrature Amplitude Modulation)**은 진폭(ASK)과 위상(PSK)을 동시에 변화시켜 심볼당 여러 비트를 전송한다.

```text
16-QAM:  4비트/심볼  (Wi-Fi 4 사용)
64-QAM:  6비트/심볼  (LTE 업링크)
256-QAM: 8비트/심볼  (Wi-Fi 5, LTE-A)
1024-QAM: 10비트/심볼 (Wi-Fi 6, 5G NR)
4096-QAM: 12비트/심볼 (Wi-Fi 7)
```

차수가 높을수록 이론적 속도는 빨라지지만, 각 성상도 점이 가까워져 잡음에 취약해진다. 신호 강도(SNR)가 좋아야만 고차 QAM을 쓸 수 있다. Wi-Fi 공유기 가까이 있을 때 속도가 빠른 이유가 바로 이것이다.

```python
# SNR과 최대 이론 채널 용량 (Shannon's Theorem)
import math

def channel_capacity(bandwidth_hz, snr_db):
    """Shannon-Hartley 정리: C = B * log2(1 + SNR)"""
    snr_linear = 10 ** (snr_db / 10)
    capacity_bps = bandwidth_hz * math.log2(1 + snr_linear)
    return capacity_bps

# Wi-Fi 6: 80 MHz 채널, SNR 30 dB
cap = channel_capacity(80_000_000, 30)
print(f"이론 최대 용량: {cap / 1e6:.1f} Mbps")
# → 약 797 Mbps (1개 스트림 기준)
```

다음 글에서는 전송 중 발생하는 비트 오류를 어떻게 탐지하고 정정하는지, 특히 이더넷 FCS에 쓰이는 CRC를 상세히 살펴본다.

---

**지난 글:** [회선 교환 vs 패킷 교환](/posts/network-circuit-vs-packet-switching/)

**다음 글:** [오류 검출과 CRC: 네트워크 무결성 보장 원리](/posts/network-error-detection-crc/)

<br>
읽어주셔서 감사합니다. 😊
