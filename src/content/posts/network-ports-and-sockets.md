---
title: "포트와 소켓: 프로세스 간 통신의 끝점"
description: "포트 번호 체계, 소켓 5-tuple, 소켓 생명 주기(listen·accept·connect), 소켓 옵션, ss 명령어를 완전히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "Network"
tags: ["포트", "소켓", "5-tuple", "소켓API", "서버소켓", "임시포트", "ss명령어"]
featured: false
draft: false
---

[지난 글](/posts/network-transport-layer/)에서 전송 계층의 역할과 다중화 원리를 살펴봤다. 이번 글에서는 전송 계층을 애플리케이션에서 실제로 사용하는 인터페이스인 **포트**와 **소켓**을 깊이 다룬다.

## 포트란?

포트는 **같은 IP 주소를 가진 호스트 내에서 프로세스를 구분하는 16비트 숫자**다. 0~65535 범위를 가진다. 하나의 서버가 여러 서비스를 동시에 제공할 때 포트로 구분한다.

```bash
# 자주 사용하는 Well-known 포트
20/21  FTP (데이터/제어)
22     SSH
25     SMTP
53     DNS
80     HTTP
443    HTTPS
3306   MySQL
5432   PostgreSQL
6379   Redis
27017  MongoDB
```

## 소켓 5-tuple

소켓(Socket)은 네트워크 통신의 끝점(endpoint)이다. 하나의 TCP 연결은 **5-tuple**로 고유하게 식별된다.

![소켓 5-tuple 구조](/assets/posts/network-ports-and-sockets-5tuple.svg)

- **(프로토콜, 출발지 IP, 출발지 포트, 목적지 IP, 목적지 포트)**

같은 서버의 같은 포트(예: :443)에 수만 개의 클라이언트가 동시에 연결될 수 있다. 각 클라이언트의 임시 포트가 다르기 때문에 5-tuple이 고유하게 유지된다.

## 소켓 생명 주기

![소켓 API 생명 주기](/assets/posts/network-ports-and-sockets-lifecycle.svg)

### 서버 소켓 구현

```python
import socket
import threading

def handle_client(conn, addr):
    print(f"연결: {addr}")
    with conn:
        while True:
            data = conn.recv(1024)
            if not data:
                break
            conn.sendall(data)  # echo back

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# SO_REUSEADDR: TIME_WAIT 상태 포트 즉시 재사용
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

server.bind(('0.0.0.0', 8080))
server.listen(128)  # 백로그 크기: 수락 대기 큐

print("서버 대기 중...")
while True:
    conn, addr = server.accept()  # 블로킹: 연결 올 때까지 대기
    t = threading.Thread(target=handle_client, args=(conn, addr))
    t.start()
```

### 클라이언트 소켓 구현

```python
import socket

client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# TCP_NODELAY: Nagle 알고리즘 비활성화 (실시간 앱)
client.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

# SO_KEEPALIVE: 유휴 연결 살아있는지 확인
client.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)

client.connect(('127.0.0.1', 8080))
client.sendall(b'Hello, World!')
data = client.recv(1024)
print(f"수신: {data}")
client.close()
```

## 중요한 소켓 옵션

| 옵션 | 레벨 | 설명 |
|------|------|------|
| `SO_REUSEADDR` | SOL_SOCKET | TIME_WAIT 포트 즉시 재사용 |
| `SO_REUSEPORT` | SOL_SOCKET | 동일 포트 여러 프로세스 공유 |
| `SO_KEEPALIVE` | SOL_SOCKET | 유휴 연결 주기적 확인 |
| `SO_SNDBUF/RCVBUF` | SOL_SOCKET | 송수신 버퍼 크기 조정 |
| `TCP_NODELAY` | IPPROTO_TCP | Nagle 알고리즘 비활성화 |
| `TCP_BACKLOG` | - | listen() 큐 크기 |

`SO_REUSEPORT`는 같은 포트에 여러 프로세스/스레드가 리스닝할 수 있게 한다. 커널이 연결을 자동으로 로드밸런싱해서 멀티코어 서버 성능을 높인다.

## ss 명령어로 소켓 상태 분석

```bash
# 리스닝 TCP 포트
ss -tlnp

# 모든 TCP 연결 (ESTABLISHED 포함)
ss -tn

# 소켓 통계 요약
ss -s

# 특정 포트 필터
ss -tn dport = :443

# 프로세스별 연결 수 집계
ss -tn | awk 'NR>1 {print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn

# 상태별 TCP 연결 수
ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c

# 출력 예:
# 1450 ESTABLISHED
#  120 TIME-WAIT
#    3 LISTEN
```

## 포트 스캔과 보안

서비스에 불필요한 포트를 열어두면 공격 표면이 된다.

```bash
# 자신의 열린 포트 확인
ss -tlnp
nmap -sT localhost

# 방화벽으로 포트 제한
ufw allow 22/tcp
ufw allow 443/tcp
ufw deny 3306/tcp  # DB 포트는 외부 차단

# 특정 IP만 허용
iptables -A INPUT -p tcp --dport 5432 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -j DROP
```

운영 환경에서는 서비스에 필요한 포트만 열고, DB·캐시·내부 서비스는 반드시 방화벽으로 차단해야 한다.

---

**지난 글:** [전송 계층: TCP와 UDP의 역할과 구조](/posts/network-transport-layer/)

<br>
읽어주셔서 감사합니다. 😊
