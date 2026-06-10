---
title: "오류 감지: CRC와 체크섬의 원리"
description: "네트워크에서 비트 오류를 감지하는 패리티 비트, 체크섬, CRC(순환중복검사)의 원리와 이더넷 FCS 활용을 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 8
type: "knowledge"
category: "Network"
tags: ["CRC", "체크섬", "오류감지", "FCS", "이더넷", "물리계층", "패리티비트"]
featured: false
draft: false
---

[지난 글](/posts/network-signaling-encoding/)에서 비트가 신호로 변환되는 방법을 살펴봤다. 전선을 타고 이동하는 신호는 전기적 노이즈, 간섭, 신호 감쇠로 인해 손상될 수 있다. 수신측은 받은 데이터가 정확한지 어떻게 알 수 있을까? 그 답이 **오류 감지(Error Detection)** 기법이다.

## 오류의 종류

```text
단일 비트 오류: 1이 0으로, 0이 1로 뒤집힌 경우
버스트 오류:    연속된 여러 비트가 손상된 경우 (더 흔함)
            → 이더넷에서 주로 전기적 노이즈로 발생
```

버스트 오류가 더 일반적이기 때문에, 현대 인코딩 기법은 버스트 오류 감지 능력을 중시한다.

![오류 감지 기법 비교](/assets/posts/network-error-detection-crc-types.svg)

## 패리티 비트 (Parity Bit)

가장 단순한 오류 감지법이다. 데이터의 1 비트 개수를 짝수(even parity) 또는 홀수(odd parity)가 되도록 1비트를 추가한다.

```text
데이터: 1010101  (1의 개수: 4개, 짝수)
짝수 패리티 비트: 0 추가
전송: 10101010

수신: 10001010  ← 비트 하나 손상
1의 개수: 3 (홀수) → 오류 감지!
```

단일 비트 오류는 감지하지만, 2비트가 동시에 뒤집히면 감지 불가다. RS-232 직렬 통신 등 단순 환경에서 사용됐다.

## 체크섬 (Checksum)

IP 헤더, UDP, TCP에서 사용하는 방식이다. 데이터를 16비트 단위로 잘라 모두 더한 후 1의 보수(ones' complement)를 취한다.

```text
IP 헤더 체크섬 계산:
1. 체크섬 필드를 0으로 놓고 헤더를 16비트 단위로 분할
2. 모두 더함 (carry가 나오면 최하위 비트에 더함)
3. 결과의 1의 보수 → 체크섬 필드에 저장

수신측:
1. 동일 방법으로 16비트 단위 합산
2. 결과가 0xFFFF이면 정상
```

계산이 빠르고 소프트웨어 구현이 쉽다. 다만 같은 값의 교환(예: 바이트 순서 바뀜)은 감지 못할 수 있어 신뢰성이 CRC보다 낮다.

## CRC (Cyclic Redundancy Check)

이더넷, Wi-Fi, USB, SATA 등 현대 네트워크에서 가장 널리 쓰는 오류 감지 방식이다. 다항식 나눗셈을 사용한다.

![이더넷 프레임의 FCS](/assets/posts/network-error-detection-crc-ethernet.svg)

```text
CRC 기본 원리:
1. 데이터 D를 이진 다항식으로 표현
2. 생성 다항식 G로 나눠 나머지 R 계산
3. R을 FCS로 데이터 뒤에 붙여 전송

수신측:
(D + R) ÷ G = 나머지 0 → 오류 없음
              나머지 ≠ 0 → 오류 감지
```

이더넷 CRC-32는 32비트 다항식을 사용하며 다음을 보장한다.

```text
CRC-32 감지 능력:
- 모든 단일 비트 오류
- 모든 2비트 오류 (데이터 길이 상관없이)
- 홀수 개 비트 오류
- 32비트 이하 버스트 오류 100%
- 33비트 이상 버스트 오류도 99.99%+ 감지
```

## FCS와 이더넷

이더넷 프레임의 마지막 4바이트가 **FCS(Frame Check Sequence)**다. 수신 NIC가 CRC-32를 검증하고, 오류 프레임을 자동으로 폐기한다. 상위 계층(IP, TCP)에는 정상 프레임만 전달된다.

```bash
# ethtool로 NIC 오류 통계 확인
ethtool -S eth0 | grep -i error
# rx_crc_errors: CRC 오류로 폐기된 수신 프레임 수
# rx_frame_errors: 프레임 정렬 오류
```

`rx_crc_errors`가 많으면 케이블 불량, NIC 이상, EMI 간섭을 의심한다.

## 오류 감지 vs 오류 수정

CRC는 **감지(Detection)**만 한다. 오류가 발견되면 프레임을 버릴 뿐이다. 오류 **수정(Correction)**은 다른 메커니즘이 담당한다.

```text
오류 수정 방법:
- ARQ (Automatic Repeat reQuest): 오류 감지 후 재전송 요청
  → TCP가 사용하는 방식
- FEC (Forward Error Correction): 데이터에 여분의 정보를 추가해
  수신측이 직접 오류를 수정
  → 위성 통신, 광섬유, 5G mmWave에서 사용
  → Reed-Solomon, Turbo Code, LDPC
```

네트워크 링크는 FEC 또는 CRC+재전송으로 오류를 처리하며, 상위 TCP 계층이 종단 간 신뢰성을 최종 보장한다.

---

**지난 글:** [신호와 인코딩](/posts/network-signaling-encoding/)

**다음 글:** [MAC 주소: 이더넷의 물리적 식별자](/posts/network-mac-address/)

<br>
읽어주셔서 감사합니다. 😊
