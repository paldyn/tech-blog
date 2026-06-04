---
title: "TLS 세션 재개 — Session ID, Session Ticket, PSK"
description: "TLS 연결 재수립 비용을 줄이는 세션 재개 메커니즘: Session ID(서버 상태 저장), Session Ticket(클라이언트 저장), TLS 1.3 PSK와 0-RTT Early Data를 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "Network"
tags: ["TLS", "세션재개", "SessionTicket", "PSK", "0-RTT", "성능", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-tls-cipher-suites/)에서 TLS 암호 스위트 구조를 분해해봤습니다. TLS 핸드셰이크는 완전히 수행하면 1-2번의 왕복이 필요하고 비대칭키 연산이 들어갑니다. 같은 서버에 반복 접속할 때마다 전체 핸드셰이크를 반복하면 CPU와 RTT 비용이 무시할 수 없습니다. **세션 재개(Session Resumption)**는 이전 핸드셰이크에서 만든 키 재료를 재사용해 이 비용을 줄이는 기술입니다.

## 세 가지 세션 재개 방식

![세션 재개 방식 비교](/assets/posts/network-tls-session-resumption-flow.svg)

## 1. Session ID (TLS 1.2)

가장 오래된 방식입니다.

```
최초 연결:
  서버 → ServerHello (session_id=abc123)
  서버: session_id=abc123 → {마스터 시크릿, 암호 스위트} 메모리 저장

재연결:
  클라이언트 → ClientHello (session_id=abc123)
  서버: 해당 ID 검색 → 찾으면 축약 핸드셰이크
```

**장단점**

| 항목 | 내용 |
|------|------|
| 장점 | 구현 간단, 널리 지원됨 |
| 단점 | 서버 메모리/DB에 상태 저장 필요 |
| 단점 | 서버 여러 대면 공유 세션 저장소 필요 |
| 단점 | 서버 재시작 시 세션 소실 |
| 확장성 | 낮음 (서버 수가 많을수록 비용 증가) |

## 2. Session Ticket (TLS 1.2)

서버 측 상태 저장 문제를 해결한 방식입니다.

```
최초 연결 후:
  서버 → NewSessionTicket 메시지
         (마스터 시크릿 + 암호 스위트를 서버 비밀키로 암호화)
  클라이언트: 티켓 저장

재연결:
  클라이언트 → ClientHello + session_ticket 확장
  서버: 자신의 비밀키로 티켓 복호화 → 세션 정보 복원
```

```bash
# OpenSSL로 세션 티켓 확인
openssl s_client -connect example.com:443 \
  -sess_out /tmp/sess.pem 2>&1 | grep -A 5 "Session-ID"

# 세션 재사용 확인 (Reused: yes)
openssl s_client -connect example.com:443 \
  -sess_in /tmp/sess.pem 2>&1 | grep "Reused"
```

**장단점**

| 항목 | 내용 |
|------|------|
| 장점 | 서버 무상태(stateless) 가능 |
| 장점 | 로드밸런서 환경에서도 동작 |
| 단점 | 티켓 암호화 키 관리 필요 |
| 단점 | 티켓 키 유출 시 Forward Secrecy 소실 |

## 3. PSK / 0-RTT (TLS 1.3)

TLS 1.3은 Session Ticket과 개념은 비슷하지만 메커니즘이 더 정교합니다.

![TLS 1.3 PSK 흐름](/assets/posts/network-tls-session-resumption-psk.svg)

**흐름**

```
최초 TLS 1.3 핸드셰이크 완료 후:
  서버 → NewSessionTicket
    - ticket: 암호화된 PSK 정보
    - ticket_lifetime: 유효 시간 (초)
    - ticket_age_add: 랜덤 오프셋 (타이밍 공격 방지)
    - max_early_data_size: 0-RTT 최대 크기

재연결 시:
  클라이언트 → ClientHello
    - psk_key_exchange_modes: psk_dhe_ke
    - pre_shared_key: [identity=ticket, binder=HMAC]
    - early_data (선택): 0-RTT 앱 데이터
```

**PSK 바인더(Binder)**

단순히 티켓을 재전송하는 것이 아닙니다. 클라이언트는 현재 핸드셰이크 내용을 HMAC으로 서명해서 PSK가 해당 핸드셰이크에 바인딩됨을 증명합니다.

```python
# Binder 계산 (의사코드)
binder_key = HKDF_Expand(psk, "res binder", hash_len)
transcript_hash = hash(ClientHello_partial)  # binder 제외
binder = HMAC(binder_key, transcript_hash)
```

## 0-RTT Early Data 상세

0-RTT를 사용하면 서버 응답 전에 앱 데이터를 보낼 수 있습니다.

```
일반 재개 (1-RTT):
클라이언트: ClientHello + PSK
서버:       ServerHello + {Extensions + Finished}
클라이언트: Finished
클라이언트: 앱 데이터 전송  ← 3번째 메시지부터

0-RTT Early Data:
클라이언트: ClientHello + PSK + Early Data  ← 즉시 전송!
서버:       ServerHello + {Extensions + Finished}
클라이언트: Finished + 앱 데이터
```

**0-RTT 재전송 공격 위험**

```
정상: 클라이언트 → [Early Data: DELETE /resource] → 서버 (처리)

공격:
1. 공격자 캡처: [Early Data: DELETE /resource]
2. 서버 재전송: [Early Data: DELETE /resource] → 서버 (재처리!)
3. 같은 동작이 반복됨!
```

따라서 0-RTT 적용 기준:

```
✓ 사용 가능: GET, HEAD (멱등)
✓ 사용 가능: 읽기 전용 조회 API
✗ 사용 금지: POST, PUT, DELETE (상태 변경)
✗ 사용 금지: 로그인, 결제, 중요 업무 처리
```

## Nginx/Apache에서 세션 재개 설정

```nginx
# Nginx Session Ticket 설정
ssl_session_ticket_key /etc/nginx/ticket.key;  # 32 또는 48바이트 키
ssl_session_timeout 1d;

# TLS 1.3 0-RTT 활성화 (Nginx 1.25.1+)
ssl_early_data on;
proxy_set_header Early-Data $ssl_early_data;  # 백엔드에 알림

# 백엔드에서 Early-Data 헤더 확인
if ($http_early_data = "1") {
    return 425;  # Too Early (RFC 8470)
}
```

## 세션 재개 방식 선택 기준

```
단일 서버: Session ID 또는 Session Ticket 둘 다 OK
다중 서버: Session Ticket (공유 키 필요) 또는 외부 Redis 세션 저장소
TLS 1.3 환경: PSK 자동 사용 (NewSessionTicket 포함)
0-RTT 사용: GET 요청만 허용, 보수적으로 적용
```

---

**지난 글:** [TLS 암호화 스위트 해부](/posts/network-tls-cipher-suites/)

**다음 글:** [mTLS — 상호 TLS 인증 완전 정리](/posts/network-mtls/)

<br>
읽어주셔서 감사합니다. 😊
