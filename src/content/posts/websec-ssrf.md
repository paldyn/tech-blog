---
title: "SSRF: 서버 사이드 요청 위조 — 내부망을 여는 취약점"
description: "서버를 프록시로 악용해 내부 네트워크를 침투하는 SSRF 공격의 원리, 클라우드 메타데이터 탈취, DNS Rebinding, 그리고 허용 목록과 네트워크 격리 방어법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["SSRF", "웹 보안", "OWASP", "클라우드 보안", "내부망", "AWS 메타데이터"]
featured: false
draft: false
---

[지난 글](/posts/websec-csrf-samesite/)에서 CSRF와 SameSite 쿠키를 깊이 살펴봤습니다. 이번 글의 주제인 **SSRF(Server-Side Request Forgery, 서버 사이드 요청 위조)**는 이름이 비슷하지만 완전히 다른 공격입니다. 공격자가 취약한 서버로 하여금 공격자가 지정한 내부 또는 외부 URL로 HTTP 요청을 보내게 만드는 취약점입니다. 방화벽 뒤의 내부 서비스를 외부에서 직접 공격하는 것은 불가능하지만, 공개 서버를 프록시로 사용하면 가능해집니다.

## SSRF란?

서버가 사용자 입력으로 받은 URL에 직접 HTTP 요청을 보내는 기능이 취약점의 근원입니다. URL 미리보기, 웹훅, 파일 임포트, PDF 생성, 이미지 다운로드 같은 기능이 전형적인 SSRF 공격 벡터입니다.

```
# 정상 요청
GET /fetch?url=https://api.partner.com/data

# SSRF 공격 요청
GET /fetch?url=http://192.168.1.100:5432/   # 내부 DB 서버
GET /fetch?url=http://169.254.169.254/latest/meta-data/  # AWS 메타데이터
GET /fetch?url=http://localhost:6379/  # 로컬 Redis
GET /fetch?url=file:///etc/passwd  # 로컬 파일 (file:// 프로토콜)
```

![SSRF 공격 흐름: 서버를 내부 프록시로 악용](/assets/posts/websec-ssrf-flow.svg)

## 공격 가능한 대상

**클라우드 메타데이터 서비스**: AWS, GCP, Azure의 인스턴스 메타데이터 엔드포인트는 링크-로컬 주소(`169.254.169.254`)에서 인증 없이 접근 가능합니다. 여기서 IAM 자격증명을 탈취하면 클라우드 전체 권한을 얻을 수 있습니다.

**내부 네트워크 서비스**: 방화벽으로 외부에서 접근이 막힌 Redis, Memcached, Elasticsearch, 내부 관리 패널 등에 접근할 수 있습니다.

**로컬호스트 서비스**: 서버 자신의 로컬에서만 실행 중인 서비스(예: 관리자 전용 API)에 접근합니다.

**포트 스캔**: 내부 IP 범위를 순회하며 어떤 포트가 열려 있는지 탐색할 수 있습니다.

## 취약한 코드 패턴

```python
# Python requests (취약)
import requests

@app.route('/fetch')
def fetch_url():
    url = request.args.get('url')
    # ❌ URL 검증 없이 바로 요청
    response = requests.get(url, timeout=5)
    return response.content

# Node.js axios (취약)
app.get('/preview', async (req, res) => {
  const url = req.query.url;
  // ❌ 검증 없음
  const response = await axios.get(url);
  res.json({ content: response.data });
});
```

```javascript
// 자주 보이는 웹훅 기능 (취약)
app.post('/webhook/register', async (req, res) => {
  const { callbackUrl } = req.body;
  // ❌ 사용자가 지정한 URL에 이벤트 발송
  await fetch(callbackUrl, {
    method: 'POST',
    body: JSON.stringify(event)
  });
});
```

## DNS Rebinding 공격 우회

단순히 URL에서 IP를 추출해 내부 IP를 차단하는 것만으로는 부족합니다. **DNS Rebinding** 공격으로 우회할 수 있기 때문입니다:

1. 공격자가 `attacker.com`의 DNS TTL을 0으로 설정
2. 첫 번째 DNS 조회: 검증 통과용 공개 IP 반환
3. 서버가 "안전하다"고 판단 후 실제 요청
4. 두 번째 DNS 조회(TTL 0이므로 즉시 재조회): 내부 IP 반환
5. 내부 서비스에 요청 도달

```python
# 방어: 검증과 요청에 같은 IP 사용 (DNS 재조회 방지)
import socket, ipaddress, requests
from urllib.parse import urlparse

def safe_fetch(url: str) -> bytes:
    parsed = urlparse(url)
    # 프로토콜 검증
    if parsed.scheme not in ('http', 'https'):
        raise ValueError('허용되지 않은 프로토콜')
    
    hostname = parsed.hostname
    # DNS 조회 (한 번만)
    ip = socket.gethostbyname(hostname)
    
    # 내부 IP 차단
    addr = ipaddress.ip_address(ip)
    blocked_nets = [
        ipaddress.ip_network('10.0.0.0/8'),
        ipaddress.ip_network('172.16.0.0/12'),
        ipaddress.ip_network('192.168.0.0/16'),
        ipaddress.ip_network('169.254.0.0/16'),
        ipaddress.ip_network('127.0.0.0/8'),
        ipaddress.ip_network('::1/128'),
    ]
    for net in blocked_nets:
        if addr in net:
            raise ValueError(f'내부 IP 접근 차단: {ip}')
    
    # IP로 직접 요청 (DNS 재조회 방지)
    port = parsed.port or (443 if parsed.scheme == 'https' else 80)
    direct_url = f"{parsed.scheme}://{ip}:{port}{parsed.path}"
    headers = {'Host': hostname}  # Host 헤더 유지
    return requests.get(direct_url, headers=headers, timeout=5).content
```

## 방어 전략

![SSRF 방어: 허용 목록과 네트워크 격리](/assets/posts/websec-ssrf-defense.svg)

**블랙리스트보다 화이트리스트**: 내부 IP 범위를 차단하는 블랙리스트는 우회 가능한 경우가 많습니다. 서버가 요청을 보낼 수 있는 호스트 목록을 명시적으로 허용하는 화이트리스트 방식이 더 안전합니다.

**네트워크 레벨 격리**: 웹 서버에서 내부망으로 직접 TCP 연결이 불가능하도록 방화벽 규칙을 설정합니다. 외부 요청이 필요한 경우 전용 아웃바운드 프록시를 경유하도록 강제합니다.

**AWS IMDSv2 활성화**: AWS를 사용하는 경우 메타데이터 서비스를 토큰 기반(IMDSv2)으로만 접근 가능하게 설정합니다. SSRF로는 PUT 요청을 통해 토큰을 먼저 발급해야 하므로 공격이 훨씬 어려워집니다.

```bash
# AWS EC2 IMDSv2 강제 설정
aws ec2 modify-instance-metadata-options \
  --instance-id i-xxxx \
  --http-tokens required \
  --http-endpoint enabled
```

**응답 필터링**: 내부 IP, 클라우드 메타데이터 관련 응답 내용을 사용자에게 그대로 반환하지 않습니다. 오류 메시지도 구체적인 내부 정보를 노출하지 않도록 처리합니다.

## OWASP Top 10과 SSRF

SSRF는 OWASP Top 10 2021에서 독립 카테고리(A10)로 격상되었습니다. 클라우드 아키텍처의 확산으로 마이크로서비스 간 통신, 서버리스 함수, 컨테이너 환경에서 SSRF 공격면이 크게 늘어났기 때문입니다.

사용자 입력 URL을 서버가 직접 요청하는 기능은 SSRF 위험이 있다고 간주하고, 화이트리스트 검증과 네트워크 격리를 기본으로 적용해야 합니다.

---

**지난 글:** [CSRF와 SameSite: 현대적 쿠키 보안의 모든 것](/posts/websec-csrf-samesite/)

**다음 글:** [SSRF와 클라우드 메타데이터: AWS/GCP/Azure 자격증명 탈취](/posts/websec-ssrf-cloud-metadata/)

<br>
읽어주셔서 감사합니다. 😊
