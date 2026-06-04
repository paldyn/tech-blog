---
title: "mTLS — 상호 TLS 인증 완전 정리"
description: "단방향 TLS와 달리 클라이언트도 인증서로 신원을 증명하는 mTLS의 핸드셰이크 흐름, 인증서 설정, 마이크로서비스 적용 패턴, 제로트러스트 아키텍처를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "Network"
tags: ["mTLS", "상호인증", "TLS", "마이크로서비스", "제로트러스트", "보안", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-tls-session-resumption/)에서 TLS 세션 재개 메커니즘을 살펴봤습니다. 일반적인 TLS는 서버만 인증서를 제시합니다. 우리가 은행 웹사이트에 접속할 때 서버가 진짜인지 확인하지만, 서버는 우리가 누구인지 TLS 레벨에서 검증하지 않습니다. **mTLS(Mutual TLS)**는 이 균형을 맞춥니다. 양쪽이 모두 인증서로 신원을 증명합니다.

## 단방향 TLS vs mTLS

![mTLS 핸드셰이크 흐름](/assets/posts/network-mtls-flow.svg)

단방향 TLS의 핸드셰이크와 mTLS의 차이는 단 두 가지 메시지에 있습니다.

```
단방향 TLS:
  서버 → Certificate (서버 인증서)
  서버 → CertificateVerify (서버 서명)

mTLS 추가:
  서버 → CertificateRequest ← 이것!
  클라이언트 → Certificate (클라이언트 인증서)
  클라이언트 → CertificateVerify (클라이언트 서명) ← 이것!
```

## mTLS 핸드셰이크 단계별

```
1. ClientHello (클라이언트 → 서버)
   지원 암호 스위트, 클라이언트 key_share

2. ServerHello + Certificate + CertificateRequest (서버 → 클라이언트)
   ↑ CertificateRequest: "인증서 보내주세요"
   서버 인증서, 허용 CA 목록

3. 클라이언트 측 처리
   서버 인증서 체인 검증 ← 일반 TLS와 동일
   클라이언트 인증서 준비

4. Certificate + CertificateVerify + Finished (클라이언트 → 서버)
   클라이언트 인증서 전송
   클라이언트 개인키로 핸드셰이크 서명

5. 서버 측 처리
   클라이언트 인증서 체인 검증
   서명 검증 → 통과 시에만 연결 허용
```

## 인증서 준비

mTLS를 위해 클라이언트도 인증서가 필요합니다. 일반적으로 조직 내부 CA로 발급합니다.

```bash
# 1. 내부 CA 생성
openssl genrsa -out ca-key.pem 4096
openssl req -new -x509 -days 3650 \
  -key ca-key.pem \
  -out ca-cert.pem \
  -subj "/CN=Internal-CA/O=MyOrg"

# 2. 클라이언트 인증서 생성
openssl genrsa -out client-key.pem 2048
openssl req -new -key client-key.pem \
  -out client-csr.pem \
  -subj "/CN=service-a/O=MyOrg"

# 3. CA로 서명 (SAN 포함)
cat > client-ext.cnf << EOF
[SAN]
subjectAltName = DNS:service-a, DNS:service-a.namespace.svc.cluster.local
EOF

openssl x509 -req -days 365 \
  -in client-csr.pem \
  -CA ca-cert.pem -CAkey ca-key.pem \
  -CAcreateserial \
  -out client-cert.pem \
  -extfile client-ext.cnf \
  -extensions SAN
```

## Nginx mTLS 서버 설정

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/server-cert.pem;
    ssl_certificate_key /etc/ssl/server-key.pem;

    # 클라이언트 인증서 요구
    ssl_client_certificate /etc/ssl/ca-cert.pem;  # 신뢰하는 CA
    ssl_verify_client on;       # 필수 검증
    ssl_verify_depth 2;          # CA 체인 깊이

    location / {
        # 인증된 클라이언트 정보를 백엔드로 전달
        proxy_set_header X-Client-CN $ssl_client_s_dn_cn;
        proxy_set_header X-Client-Verify $ssl_client_verify;
        proxy_pass http://backend;
    }
}
```

## mTLS 적용 아키텍처

![mTLS 마이크로서비스 아키텍처](/assets/posts/network-mtls-usecase.svg)

### 마이크로서비스 간 mTLS

쿠버네티스 환경에서 Istio나 Linkerd 같은 서비스 메시를 사용하면 mTLS를 자동으로 처리할 수 있습니다.

```yaml
# Istio PeerAuthentication: 네임스페이스 전체 mTLS 강제
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT   # PERMISSIVE: mTLS 선택적, STRICT: 필수
```

```yaml
# Istio AuthorizationPolicy: 특정 서비스만 허용
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-service-a-only
  namespace: production
spec:
  selector:
    matchLabels:
      app: service-b
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/production/sa/service-a"]
```

### Python에서 mTLS 연결

```python
import ssl
import urllib.request

# mTLS 컨텍스트 생성
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
ctx.load_cert_chain(
    certfile='client-cert.pem',
    keyfile='client-key.pem'
)
ctx.load_verify_locations('ca-cert.pem')
ctx.verify_mode = ssl.CERT_REQUIRED

# 요청
req = urllib.request.Request('https://api.example.com/data')
with urllib.request.urlopen(req, context=ctx) as resp:
    data = resp.read()
```

## 클라이언트 인증서 검증 코드에서 활용

서버 측에서 클라이언트 인증서 정보를 활용할 수 있습니다.

```python
# Flask 예시: 클라이언트 인증서 정보 활용
from flask import request, abort

@app.before_request
def check_client_cert():
    # Nginx에서 전달한 검증 결과 헤더 확인
    verify = request.headers.get('X-Client-Verify')
    cn = request.headers.get('X-Client-CN')
    
    if verify != 'SUCCESS':
        abort(403, "Valid client certificate required")
    
    # CN으로 서비스 식별 및 접근 제어
    allowed_services = ['service-a', 'service-b', 'gateway']
    if cn not in allowed_services:
        abort(403, f"Service '{cn}' not authorized")
    
    request.client_identity = cn
```

## 제로트러스트와 mTLS

mTLS는 **제로트러스트(Zero Trust) 아키텍처**의 핵심 구성 요소입니다.

```
전통적 보안 모델:
  "내부 네트워크는 신뢰" → VPN으로 내부 진입 후 자유 이동

제로트러스트 모델:
  "아무것도 신뢰하지 않음" → 모든 연결을 명시적으로 인증

mTLS의 역할:
  ✓ 서비스 간 모든 통신이 암호화됨
  ✓ 각 서비스는 인증서로 신원 증명
  ✓ 인증서 없는 서비스는 연결 자체가 불가
  ✓ 인증서 만료/폐기로 즉시 접근 차단
```

## 인증서 수명 주기 관리

mTLS 환경에서 인증서를 수동 관리하면 운영 부담이 큽니다. 자동화 도구가 필수입니다.

```bash
# cert-manager (Kubernetes)로 자동 갱신
# CertificateRequest 자동 처리, 만료 전 갱신

# Vault PKI로 단기 수명 인증서 발급 (1일~7일)
vault write pki/issue/service-role \
  common_name="service-a.prod.svc" \
  ttl="24h"
# 짧은 TTL: 침해 시 빠른 무효화
```

---

**지난 글:** [TLS 세션 재개 — Session ID, Session Ticket, PSK](/posts/network-tls-session-resumption/)

**다음 글:** [인증서와 PKI — X.509, CA 체인, 신뢰 구축](/posts/network-certificates-pki/)

<br>
읽어주셔서 감사합니다. 😊
