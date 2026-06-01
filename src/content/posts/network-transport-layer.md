---
title: "전송 계층: TCP와 UDP의 역할과 구조"
description: "전송 계층의 역할, 다중화·역다중화, 포트 번호 체계, 세그멘테이션, 체크섬을 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["전송계층", "TCP", "UDP", "포트", "다중화", "세그멘테이션", "소켓"]
featured: false
draft: false
---

[지난 글](/posts/network-dhcp/)에서 DHCP로 네트워크 설정을 자동으로 받는 방법을 살펴봤다. 이번 글에서는 애플리케이션과 네트워크를 연결하는 계층인 **전송 계층(Transport Layer)**의 역할과 구조를 다룬다.

## 전송 계층의 위치와 역할

전송 계층은 OSI 4계층, TCP/IP 모델의 3계층에 해당한다. IP(네트워크 계층)가 **호스트 간** 통신을 담당한다면, 전송 계층은 **프로세스 간** 통신을 담당한다.

![전송 계층 개요](/assets/posts/network-transport-layer-overview.svg)

전송 계층의 핵심 역할:
1. **다중화·역다중화**: 포트 번호로 여러 애플리케이션을 구분
2. **신뢰성(TCP)**: 순서 보장, 손실 재전송, 오류 복구
3. **세그멘테이션**: 큰 데이터를 MSS 크기로 분할 후 재조립
4. **오류 감지**: 체크섬으로 비트 오류 탐지

## 다중화와 역다중화

하나의 IP 주소를 가진 호스트에서 브라우저, SSH 클라이언트, 데이터베이스 연결이 동시에 동작한다. 전송 계층은 **포트 번호**로 이를 구분한다.

![다중화와 역다중화](/assets/posts/network-transport-layer-mux.svg)

소켓은 `(프로토콜, 출발지IP, 출발지포트, 목적지IP, 목적지포트)` 5-tuple로 식별된다. 수신 측은 목적지 포트를 보고 어느 프로세스에게 데이터를 전달할지 결정한다.

```python
import socket

# TCP 소켓 생성 및 연결
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('example.com', 443))

# 소켓 정보 확인 (5-tuple)
print(sock.getsockname())   # (로컬IP, 임시포트)
print(sock.getpeername())   # (원격IP, 443)

# UDP 소켓 (비연결형)
udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
udp_sock.sendto(b"hello", ('8.8.8.8', 53))
```

## 세그멘테이션

애플리케이션이 큰 데이터를 전송할 때, 전송 계층은 이를 **MSS(Maximum Segment Size)** 단위로 분할한다.

```text
파일 크기: 10 MB = 10,485,760 bytes
MSS: 1460 bytes (이더넷 MTU 1500 - TCP 20 - IP 20)

필요 세그먼트 수: 10,485,760 / 1460 ≈ 7181개 세그먼트
각 세그먼트에 시퀀스 번호 부여 → 순서대로 재조립
```

IP 단편화(Fragmentation)와 다르다. 세그멘테이션은 전송 계층에서 발생하며, 라우터가 아닌 양 끝단이 처리한다.

## TCP vs UDP 선택 기준

| 기준 | TCP | UDP |
|------|-----|-----|
| 연결 | 연결 지향 (3-way handshake) | 비연결형 |
| 신뢰성 | 보장 (재전송, 순서) | 없음 |
| 오버헤드 | 높음 (헤더 20바이트+) | 낮음 (헤더 8바이트) |
| 지연 | 상대적으로 높음 | 낮음 |
| 사용 | HTTP, FTP, SSH | DNS, DHCP, 스트리밍, 게임 |

```bash
# 열린 TCP/UDP 포트 확인
ss -tlnp   # TCP 리스닝 포트
ss -ulnp   # UDP 리스닝 포트
ss -s      # 소켓 요약 통계

# 특정 포트 프로세스 확인
ss -tlnp | grep :443
lsof -i :443
```

## 체크섬

TCP와 UDP 모두 **체크섬**으로 데이터 무결성을 확인한다. 단, 체크섬은 오류를 탐지할 뿐 복구하지는 않는다. 복구는 TCP의 ARQ(자동 재전송) 메커니즘이 담당한다.

체크섬 계산에는 실제 IP 헤더의 일부 필드를 포함한 **Pseudo Header**를 사용한다:
- 출발지 IP, 목적지 IP, 프로토콜 번호, TCP/UDP 길이

이를 통해 다른 호스트에게 전달된 패킷을 감지할 수 있다.

```python
import struct

def compute_checksum(data: bytes) -> int:
    if len(data) % 2 != 0:
        data += b'\x00'
    total = 0
    for i in range(0, len(data), 2):
        word = (data[i] << 8) + data[i + 1]
        total += word
        total = (total & 0xffff) + (total >> 16)
    return ~total & 0xffff
```

## 포트 범위와 임시 포트

클라이언트가 서버에 연결할 때 운영체제가 자동으로 **임시 포트(Ephemeral Port)**를 할당한다.

```bash
# Linux 임시 포트 범위 확인 및 변경
cat /proc/sys/net/ipv4/ip_local_port_range
# 32768 60999

# 범위 확장 (많은 연결이 필요한 서버)
echo "1024 65535" > /proc/sys/net/ipv4/ip_local_port_range

# TIME_WAIT 빠른 재사용 (단기 연결이 많은 경우)
sysctl net.ipv4.tcp_tw_reuse=1
```

---

**지난 글:** [DHCP: 동적 IP 주소 할당의 원리](/posts/network-dhcp/)

**다음 글:** [포트와 소켓: 프로세스 간 통신의 끝점](/posts/network-ports-and-sockets/)

<br>
읽어주셔서 감사합니다. 😊
