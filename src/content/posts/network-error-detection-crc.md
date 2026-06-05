---
title: "오류 감지와 CRC: 데이터 무결성 보장의 핵심"
description: "네트워크 전송 오류를 감지하는 패리티 비트, 체크섬, CRC의 원리를 비교하고, 이더넷 FCS와 TCP 체크섬 동작을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["CRC", "체크섬", "오류감지", "FCS", "패리티비트", "데이터무결성"]
featured: false
draft: false
---

[지난 글](/posts/network-signaling-encoding/)에서 신호 인코딩을 살펴봤다. 이번 글에서는 물리 계층에서 발생하는 **비트 오류(Bit Error)**를 감지하는 메커니즘인 **오류 감지(Error Detection)**와 그 핵심 기술인 **CRC(Cyclic Redundancy Check)**를 다룬다.

## 왜 오류 감지가 필요한가

네트워크를 통해 이동하는 데이터는 다양한 이유로 손상될 수 있다.

```
비트 오류의 원인:
  - 전기적 간섭 (전자기 노이즈, EMI)
  - 신호 감쇠 (장거리 케이블)
  - 열 잡음 (열에 의한 전자 움직임)
  - 광섬유 연결 불량
  - 무선 환경 페이딩

오류 유형:
  단일 비트 오류: 1개 비트만 뒤집힘 (드물지만 발생)
  버스트 오류: 연속된 여러 비트 오류 (더 일반적)
  예) 10001010 → 10110010 (버스트 오류)
```

## 패리티 비트 (Parity Bit)

가장 단순한 오류 감지. 데이터의 1비트 수를 짝수/홀수로 맞추는 1비트를 추가한다.

```python
def even_parity(data_bits):
    """짝수 패리티 비트 계산"""
    count = data_bits.count('1')
    return '0' if count % 2 == 0 else '1'

data = '1001011'  # 1의 개수: 4개 (짝수)
parity = even_parity(data)  # → '0'
transmitted = data + parity  # → '10010110'

# 수신 측 검증
def check_parity(received):
    return received.count('1') % 2 == 0  # True이면 오류 없음
```

**한계**: 짝수 개의 비트가 동시에 뒤집히면 감지 불가. 버스트 오류에 취약.

## 체크섬 (Checksum)

인터넷 프로토콜(IP, TCP, UDP)이 사용하는 방식. 데이터를 16비트 워드 단위로 합산하고 1의 보수를 취한다.

```python
def internet_checksum(data: bytes) -> int:
    """RFC 1071 인터넷 체크섬"""
    if len(data) % 2 != 0:
        data += b'\x00'  # 패딩
    
    checksum = 0
    for i in range(0, len(data), 2):
        word = (data[i] << 8) + data[i+1]
        checksum += word
        # 올림(carry) 처리
        checksum = (checksum & 0xffff) + (checksum >> 16)
    
    return ~checksum & 0xffff  # 1의 보수

# IP 헤더 체크섬 검증
# 올바른 패킷: 전체 헤더(체크섬 포함)의 합산이 0xFFFF
```

![오류 감지 방법 비교](/assets/posts/network-error-detection-crc-methods.svg)

## CRC (Cyclic Redundancy Check)

가장 강력한 오류 감지 방식. **다항식 나눗셈**을 이용한다. 이더넷 FCS(Frame Check Sequence)가 CRC-32를 사용한다.

```
CRC 원리:
  1. 메시지를 이진 다항식으로 표현
     데이터 D(x) = 1100101 → x⁶+x⁵+x²+1

  2. 생성 다항식(Generator) G(x) 결정
     CRC-32: G(x) = x³²+x²⁶+x²³+...+x+1 (IEEE 802.3)

  3. D(x) × x^r (0 r비트 뒤에 추가)을 G(x)로 나눔
     나머지(r비트)가 CRC

  4. 전송: [데이터] + [CRC r비트]

  5. 수신: 전체를 G(x)로 나눈 나머지 = 0이면 오류 없음
```

![이더넷 FCS 동작 흐름](/assets/posts/network-error-detection-crc-flow.svg)

```python
import binascii

def ethernet_fcs(payload: bytes) -> bytes:
    """이더넷 FCS 계산 (CRC-32)"""
    crc = binascii.crc32(payload) & 0xFFFFFFFF
    # 리틀엔디안으로 4바이트 반환
    return crc.to_bytes(4, byteorder='little')

# 이더넷 프레임 검증
def verify_fcs(frame: bytes) -> bool:
    """마지막 4바이트가 FCS인 이더넷 프레임 검증"""
    data = frame[:-4]
    received_fcs = frame[-4:]
    expected_fcs = ethernet_fcs(data)
    return received_fcs == expected_fcs
```

## CRC의 오류 감지 능력

CRC-32는 다음 오류를 100% 감지한다.

```
CRC-32 감지 보장:
  ✓ 32비트 이하 버스트 오류
  ✓ 홀수 개의 비트 오류
  ✓ 2비트 이상 떨어진 모든 이중 오류
  ✓ 99.9997% 이상의 랜덤 오류 감지 (32비트 이상 버스트 포함)

패리티 비트 대비:
  패리티: 1비트 오류만 감지
  CRC-32: 이더넷 프레임(최대 12KB)에서 사실상 모든 오류 감지
```

## 오류 감지 vs 오류 수정

오류 **감지**는 오류가 있는지 알지만 데이터를 복원하지 못한다. 오류 **수정**(FEC: Forward Error Correction)은 오류를 자동으로 복원한다.

```
FEC 알고리즘:
  해밍 코드 (Hamming Code):
    - 단일 비트 오류 수정
    - ECC 메모리, 데이터 전송에 사용

  Reed-Solomon:
    - 버스트 오류 수정
    - CD/DVD, QR코드, 위성 통신에 사용

  LDPC (Low-Density Parity-Check):
    - Wi-Fi 802.11n+, DVB-S2
    - 고성능, 낮은 오버헤드

  Turbo Code / Polar Code:
    - 4G LTE, 5G NR 제어 채널
    - 채널 용량에 근접한 성능
```

실제 TCP/IP는 오류 수정을 하지 않는다. CRC(이더넷 L2)나 체크섬(IP/TCP L3/L4)으로 오류를 감지하면 프레임/패킷을 폐기하고, TCP 재전송으로 복구한다.

## 각 계층의 오류 감지

```
계층별 오류 감지 메커니즘:
  물리(L1):  없음 (신호 감쇠·간섭 자체가 오류 원인)
  데이터링크(L2): CRC (이더넷 FCS, Wi-Fi FCS)
  네트워크(L3):  Internet Checksum (IP 헤더만)
  전송(L4):      Internet Checksum (TCP/UDP 세그먼트)
  응용(L7):      애플리케이션별 (HTTPS TLS MAC 등)
```

CRC는 하드웨어로 구현되어 1Gbps 이상의 속도에서도 거의 오버헤드 없이 동작한다. 이 덕분에 이더넷은 전기적 오류를 L2에서 빠르게 걸러내고, 상위 계층은 신뢰성 있는 데이터만 처리할 수 있다.

---

**지난 글:** [신호와 인코딩](/posts/network-signaling-encoding/)

**다음 글:** [MAC 주소](/posts/network-mac-address/)

<br>
읽어주셔서 감사합니다. 😊
