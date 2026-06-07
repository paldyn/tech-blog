---
title: "오류 검출과 CRC: 네트워크 무결성 보장 원리"
description: "패리티 비트, 체크섬, CRC(순환 중복 검사)의 동작 원리와 다항식 나눗셈, 이더넷 FCS, 오류 정정(FEC)까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["CRC", "오류검출", "패리티비트", "체크섬", "FCS", "이더넷", "데이터무결성"]
featured: false
draft: false
---

[지난 글](/posts/network-signaling-encoding/)에서 비트를 신호로 변환하는 인코딩과 변조 방식을 살펴봤다. 물리 매체를 통과하는 신호는 잡음, 감쇠, 충돌에 의해 비트가 뒤바뀔 수 있다. 이 **비트 오류(Bit Error)**를 탐지하지 못하면 손상된 데이터가 상위 계층으로 전달된다. 이번 글에서는 오류를 검출하는 세 가지 방법과, 이더넷이 선택한 **CRC(Cyclic Redundancy Check)**의 수학적 원리를 완전히 파헤친다.

## 오류 검출의 핵심 아이디어

오류 검출은 **중복 정보(Redundancy)**를 추가하는 방식으로 동작한다. 원본 데이터에서 파생된 작은 요약값(FCS, Checksum)을 함께 전송하고, 수신 측에서 같은 방법으로 요약값을 계산해 비교한다. 일치하면 오류 없음, 불일치하면 오류 발생으로 판단한다.

![오류 검출 방법 비교](/assets/posts/network-error-detection-crc-methods.svg)

## 패리티 비트 (Parity Check)

가장 단순한 방법이다. 데이터 비트의 1의 개수가 짝수(짝수 패리티) 또는 홀수(홀수 패리티)가 되도록 1비트를 추가한다.

```text
짝수 패리티 예:
데이터: 1010110 → 1이 4개 (짝수) → P=0
데이터: 1010111 → 1이 5개 (홀수) → P=1

수신 측: 데이터+P의 1 개수가 짝수면 OK, 홀수면 오류

한계: 2개 비트가 동시에 뒤바뀌면 감지 불가
사용: ECC 메모리 (2D 패리티), 시리얼 통신
```

## 체크섬 (Checksum)

데이터를 고정 크기 단위(보통 16비트)로 나눠 합산한 후, 보수(Complement)를 취한 값을 첨부한다.

```python
def internet_checksum(data: bytes) -> int:
    """IP/TCP/UDP 체크섬 계산 (RFC 1071)"""
    total = 0
    # 2바이트씩 합산
    for i in range(0, len(data) - 1, 2):
        word = (data[i] << 8) + data[i + 1]
        total += word
    # 홀수 바이트 처리
    if len(data) % 2:
        total += data[-1] << 8
    # 올림 처리
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return ~total & 0xFFFF

# UDP 헤더 체크섬 검증
packet = bytes([0x00, 0x50, 0x00, 0x51, 0x00, 0x1c, 0x00, 0x00])
print(f"체크섬: {internet_checksum(packet):#06x}")
```

체크섬은 IP, TCP, UDP 헤더에 필수로 포함된다. 구현이 단순하고 빠르지만, 같은 합을 내는 오류 패턴은 검출하지 못한다.

## CRC (Cyclic Redundancy Check)

이더넷 FCS, USB, Zip 파일 등에서 사용하는 가장 강력한 검출 방식이다. **GF(2) 위의 다항식 나눗셈**을 기반으로 한다.

![CRC 동작 원리](/assets/posts/network-error-detection-crc-process.svg)

```text
CRC 계산 원리 (이진 다항식 나눗셈):

1. 데이터 M = 1101011011 (10비트)
2. 생성 다항식 G = 10011 (4차, 5비트)
3. M에 (n-1)개 0 추가: M' = 11010110110000
4. M' ÷ G (XOR 나눗셈) 수행
5. 나머지 R = CRC 값 (이것이 FCS)
6. 전송: M + R

수신 측:
T(수신값) ÷ G → 나머지 = 0이면 정상
                  나머지 ≠ 0이면 오류!
```

```python
def crc32(data: bytes) -> int:
    """CRC-32 계산 (이더넷 FCS 알고리즘)"""
    # 표준 CRC-32 다항식: 0xEDB88320 (리틀 엔디언)
    crc = 0xFFFFFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0xEDB88320
            else:
                crc >>= 1
    return crc ^ 0xFFFFFFFF

frame_data = b"\x00\x1A\x2B\x3C\x4D\x5E"  # 목적지 MAC 예시
fcs = crc32(frame_data)
print(f"FCS: {fcs:#010x}")
```

## 오류 정정(FEC): 검출을 넘어 복구까지

검출(Detection)과 달리 **FEC(Forward Error Correction)**는 오류를 자동으로 **정정(Correction)**한다. 재전송 없이 복구하므로 위성 통신, 5G, 광통신처럼 왕복 지연이 큰 환경에 필수다.

```text
Hamming Code: 1비트 정정, 2비트 검출
Reed-Solomon: 다중 바이트 오류 정정 (QR코드, CD/DVD)
Turbo Code:   채널 용량에 근접하는 성능 (3G/4G)
LDPC Code:    고밀도 패리티 검사 (Wi-Fi 6, 5G NR)
Polar Code:   이론적 최적 코드 (5G NR 제어채널)
```

이더넷은 CRC로 검출 후 상위 계층(TCP)에서 재전송으로 복구하는 전략을 사용한다. 하드웨어로 10 Gbps 이상에서도 한 클록에 처리 가능하기 때문이다. 다음 글에서는 이더넷 프레임에서 핵심 역할을 하는 MAC 주소를 깊게 파헤친다.

---

**지난 글:** [신호와 인코딩: 비트를 전기 신호로 바꾸는 방법](/posts/network-signaling-encoding/)

**다음 글:** [MAC 주소 완전 정복: 구조, 역할, 실전 활용](/posts/network-mac-address/)

<br>
읽어주셔서 감사합니다. 😊
