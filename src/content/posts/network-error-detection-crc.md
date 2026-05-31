---
title: "오류 감지와 CRC: 데이터 무결성 보장의 핵심"
description: "패리티 비트, 체크섬, CRC의 원리와 차이점, 이더넷 FCS에 사용되는 CRC-32 계산 과정, 오류 감지 vs 정정 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["CRC", "체크섬", "패리티비트", "오류감지", "FCS", "이더넷"]
featured: false
draft: false
---

[지난 글](/posts/network-signaling-encoding/)에서 데이터가 물리 신호로 변환되는 과정을 살펴봤다. 어떤 매체든 전송 과정에서 잡음·간섭으로 **비트 오류**가 발생할 수 있다. 이를 감지하지 못하면 잘못된 데이터가 조용히 전달된다. 오류 감지 메커니즘은 바로 이 문제를 해결하기 위해 존재한다.

## 오류의 종류

물리 계층에서 발생하는 비트 오류는 두 종류다.

- **단일 비트 오류(Single-bit error)**: 전송된 비트 중 하나만 반전. 주로 열 잡음 원인.
- **연속 오류(Burst error)**: 연속된 여러 비트가 손상. 번개, EMI 등 간섭 원인.

이더넷 케이블에서 비트 오류율(BER)은 약 10⁻¹²로 극히 낮지만, 1Gbps 링크에서 초당 1조 비트를 전송하므로 방어 메커니즘은 필수다.

## 패리티 비트

가장 단순한 오류 감지 방법이다. 데이터 비트에 1개의 **패리티 비트**를 추가해 전체 1의 개수를 홀수 또는 짝수로 맞춘다.

![오류 감지 방법 비교](/assets/posts/network-error-detection-crc-methods.svg)

```python
def add_even_parity(data: int, num_bits: int = 7) -> int:
    """짝수 패리티 비트 추가"""
    ones_count = bin(data).count('1')
    parity_bit = ones_count % 2  # 1의 개수가 홀수면 parity=1로 맞춤
    return (data << 1) | parity_bit

def check_even_parity(data_with_parity: int, num_bits: int = 8) -> bool:
    """짝수 패리티 검증"""
    ones_count = bin(data_with_parity).count('1')
    return ones_count % 2 == 0

# 예시
original = 0b1010101  # 7비트, 1의 개수 = 4 (짝수)
with_parity = add_even_parity(original)
print(f"패리티 추가: {bin(with_parity)}")  # 0b10101010

# 1비트 오류 발생 (마지막 비트 반전)
corrupted = with_parity ^ 0b1
print(f"오류 감지: {not check_even_parity(corrupted)}")  # True → 감지됨

# 2비트 오류는 감지 불가
double_error = with_parity ^ 0b11
print(f"2비트 오류 감지: {not check_even_parity(double_error)}")  # False → 미감지!
```

**한계**: 짝수 개수의 비트가 동시에 뒤집히면 감지하지 못한다. ASCII 통신 등 단순한 용도에만 쓰인다.

## 체크섬 (Checksum)

IP, TCP, UDP 헤더에 사용된다. 데이터를 16비트 단위로 합산한 후 1의 보수를 취한 값이다.

```python
def compute_checksum(data: bytes) -> int:
    """인터넷 체크섬 (RFC 1071) 계산"""
    if len(data) % 2 != 0:
        data += b'\x00'  # 패딩

    total = 0
    for i in range(0, len(data), 2):
        word = (data[i] << 8) + data[i+1]
        total += word
        # 올림 자리 반영 (carry wrap-around)
        total = (total & 0xFFFF) + (total >> 16)

    return ~total & 0xFFFF  # 1의 보수

def verify_checksum(data: bytes, checksum: int) -> bool:
    """체크섬 검증: 재계산 후 0이면 정상"""
    import struct
    data_with_checksum = data + struct.pack('!H', checksum)
    result = compute_checksum(data_with_checksum)
    return result == 0

# UDP 헤더 일부 예시
udp_data = bytes([0x00, 0x35, 0x04, 0xD2, 0x00, 0x1C])  # src, dst port, length
cksum = compute_checksum(udp_data)
print(f"체크섬: 0x{cksum:04X}")
print(f"검증: {verify_checksum(udp_data, cksum)}")
```

체크섬은 계산이 빠르지만 오류의 **위치**를 파악할 수 없고, 같은 값의 두 바이트가 교환되는 경우도 놓칠 수 있다.

## CRC (Cyclic Redundancy Check)

이더넷 FCS(Frame Check Sequence), USB, ZIP 파일에 사용되는 가장 강력한 오류 감지 방식이다. **이진 다항식 나눗셈**의 나머지를 이용한다.

![CRC 계산 과정](/assets/posts/network-error-detection-crc-process.svg)

```python
def crc32(data: bytes) -> int:
    """CRC-32 계산 (이더넷 표준 다항식 0x04C11DB7 사용)"""
    # Python 내장 zlib 사용
    import zlib
    return zlib.crc32(data) & 0xFFFFFFFF

# 이더넷 프레임 FCS 계산 예시
frame_data = b"\xff\xff\xff\xff\xff\xff"  # 목적지 MAC (브로드캐스트)
frame_data += b"\x00\x1a\x2b\x3c\x4d\x5e"  # 출발지 MAC
frame_data += b"\x08\x00"  # EtherType (IPv4)
frame_data += b"\x45\x00" + b"\x00" * 18  # 최소 데이터

fcs = crc32(frame_data)
print(f"FCS: 0x{fcs:08X}")

# 수신측 검증
received = frame_data + fcs.to_bytes(4, 'little')
# 올바른 프레임은 전체 데이터(FCS 포함) CRC 결과가 고정값
residue = crc32(received)
print(f"CRC 잔여값 (0이면 정상): 0x{residue:08X}")
```

### CRC 수동 계산 원리

```
데이터 M = 1101 (4비트)
생성 다항식 G = 1011 (x³+x+1, 4비트)

1. M에 (G의 차수)개의 0 추가: M' = 1101 000
2. M' ÷ G (XOR 나눗셈):
   1101000 ÷ 1011
   1011
   ----
    110 0  (XOR 결과)
      110 00
      101 1
      -----
        1 110
          1 011
          -----
            101  ← 나머지 (FCS, 3비트)

3. 송신 프레임 = 1101 | 101
4. 수신측: (1101101) ÷ 1011 → 나머지 = 0 → 정상
```

## CRC 성능 분석

CRC-32(이더넷 표준)는 다음을 100% 감지한다.

- 길이 32 이하의 연속 오류(burst error)
- 홀수 개수의 비트 오류
- 2비트 오류 (패킷이 일정 크기 이하일 때)

```python
# CRC 표준별 비교
CRC_STANDARDS = {
    "CRC-8":    {"bits": 8,  "poly": 0x07,       "uses": "ATM HEC"},
    "CRC-16":   {"bits": 16, "poly": 0x8005,     "uses": "USB, Modbus"},
    "CRC-32":   {"bits": 32, "poly": 0x04C11DB7, "uses": "이더넷, ZIP"},
    "CRC-32C":  {"bits": 32, "poly": 0x1EDC6F41, "uses": "iSCSI, SCTP"},
}

for name, info in CRC_STANDARDS.items():
    print(f"{name:10s} | {info['bits']:2d}비트 | poly=0x{info['poly']:08X} | {info['uses']}")
```

## 오류 감지 vs 오류 정정 (FEC)

| 방식 | 설명 | 재전송 | 적합 매체 |
|------|------|--------|-----------|
| 오류 감지 + ARQ | 오류 발견 → 재전송 요청 | 필요 | 유선(재전송 비용 낮음) |
| FEC (Forward Error Correction) | 오류 자동 복원 | 불필요 | 무선, 위성 (재전송 비용 높음) |

```python
# Hamming Code — 1비트 오류 감지+정정 (FEC)
def hamming_encode(data_bits: list[int]) -> list[int]:
    """(7,4) Hamming 코드: 4비트 데이터 → 7비트 코드워드"""
    d1, d2, d3, d4 = data_bits
    p1 = d1 ^ d2 ^ d4  # 패리티 비트 1
    p2 = d1 ^ d3 ^ d4  # 패리티 비트 2
    p3 = d2 ^ d3 ^ d4  # 패리티 비트 3
    return [p1, p2, d1, p3, d2, d3, d4]

encoded = hamming_encode([1, 0, 1, 1])
print(f"Hamming 인코딩: {encoded}")  # [1, 1, 1, 0, 0, 1, 1]

# 1비트 오류 발생 → 오류 위치 파악 및 수정 가능
```

Wi-Fi, LTE, 광통신은 Reed-Solomon, LDPC, Turbo Code 등 강력한 FEC를 사용해 재전송 없이 오류를 복원한다.

## 정리

- **패리티**: 단순, 1비트 오류만 감지
- **체크섬**: IP/TCP/UDP 헤더 검증, 소프트웨어 처리 용이
- **CRC**: 이더넷 FCS 표준, 연속 오류에 강력, 하드웨어 고속 처리
- **FEC**: 무선·위성 환경, 재전송 없이 자동 정정

이더넷 스위치는 프레임 수신 시 CRC-32를 검사하고, 오류가 있으면 조용히 폐기한다. 상위 계층(TCP)의 재전송 메커니즘이 이를 보완한다.

---

**지난 글:** [신호와 인코딩: 데이터를 전파로 바꾸는 법](/posts/network-signaling-encoding/)

**다음 글:** [스위치와 MAC 학습](/posts/network-switching-mac-learning/)

<br>
읽어주셔서 감사합니다. 😊
