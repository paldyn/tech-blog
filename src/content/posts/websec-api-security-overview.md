---
title: "API 보안 개요: REST·GraphQL·gRPC API를 안전하게 설계하는 원칙"
description: "API 보안 계층 구조, OWASP API Top 10 요약, 인증/인가/Rate Limiting/에러 처리/감사 로그 원칙, API 게이트웨이 보안 설계 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["API보안", "REST", "GraphQL", "OWASP", "APIGateway", "RateLimiting", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-secrets-management/)에서 API 키와 자격증명을 안전하게 보관하는 방법을 살펴봤다. 이제 API 자체를 어떻게 안전하게 설계하고 운영할지로 넘어간다. 현대 애플리케이션은 수십에서 수백 개의 API 엔드포인트를 노출하며, 각각이 잠재적인 공격 진입점이 된다. API 보안은 단일 기술이 아니라 여러 계층의 방어를 조합하는 설계 철학이다.

## API가 특별히 위험한 이유

전통적인 웹 보안은 브라우저 렌더링 기반의 HTML 응용에 맞춰져 있었다. API는 구조화된 데이터(JSON/XML)를 직접 교환하며, 인증 토큰 하나로 수천 건의 요청을 자동화할 수 있다. 공격자 입장에서는 UI 없이 바로 데이터에 접근할 수 있고, 브루트포스·열거·자동화 공격이 훨씬 쉽다.

![API 보안 계층 구조](/assets/posts/websec-api-security-layers.svg)

## 계층별 보안 원칙

### 1계층: 전송 보안

모든 API 트래픽은 TLS 1.2+ 로만 허용한다. HTTP를 허용하는 엔드포인트는 없어야 한다. HSTS 헤더(`Strict-Transport-Security: max-age=31536000`)를 통해 클라이언트가 HTTP로 접속을 시도하지 않도록 강제한다.

```bash
# API 엔드포인트 TLS 설정 검증
curl -I https://api.example.com/health
# Strict-Transport-Security 헤더 확인

# TLS 버전/암호화 suite 점검
nmap --script ssl-enum-ciphers -p 443 api.example.com
```

### 2계층: 인증과 인가

인증(Authentication)은 "누구냐"를 확인하고, 인가(Authorization)는 "무엇을 할 수 있냐"를 결정한다. API 보안에서 가장 흔한 실수는 인증은 하면서 인가를 제대로 구현하지 않는 것이다.

```python
# FastAPI 예시: 함수 수준 인가 데코레이터
from functools import wraps
from fastapi import Depends, HTTPException

def require_role(*roles):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user=Depends(get_current_user), **kwargs):
            if current_user.role not in roles:
                raise HTTPException(status_code=403, detail="권한 없음")
            # 객체 수준 권한 확인도 필수
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator

@app.get("/api/orders/{order_id}")
@require_role("admin", "user")
async def get_order(order_id: int, current_user: User = Depends(get_current_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    # 반드시 소유자 확인 — 없으면 BOLA(IDOR) 취약점
    if order.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403)
    return order
```

### 3계층: 속도 제한

Rate Limiting은 DDoS 방어뿐 아니라 자격증명 브루트포스, 크리덴셜 스터핑, API 열거 공격을 막는 핵심 방어선이다.

```nginx
# nginx Rate Limiting
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
    limit_req_zone $http_authorization zone=user_api:10m rate=100r/m;

    server {
        location /api/auth/login {
            limit_req zone=api burst=5 nodelay;
            limit_req_status 429;
        }
        location /api/v1/ {
            limit_req zone=user_api burst=20;
        }
    }
}
```

### 입력 검증과 응답 최소화

![API 게이트웨이 보안 설계 패턴](/assets/posts/websec-api-security-design.svg)

서버는 클라이언트를 절대 신뢰하지 않는다. Content-Type 검증, 스키마 검증, 파라미터 타입/범위/길이 검사를 반드시 서버 측에서 수행한다. 클라이언트 측 검증은 UX 목적일 뿐이다.

```python
from pydantic import BaseModel, Field, validator

class CreateOrderRequest(BaseModel):
    product_id: int = Field(gt=0)  # 양수만 허용
    quantity: int = Field(ge=1, le=100)  # 1~100 범위
    notes: str = Field(max_length=500, default="")

    @validator("notes")
    def sanitize_notes(cls, v):
        # HTML 이스케이프
        return v.replace("<", "&lt;").replace(">", "&gt;")
```

응답에는 필요한 데이터만 포함한다. 사용자 목록 API에서 비밀번호 해시, 내부 ID, 시스템 필드가 노출되는 것은 명백한 설계 오류다. **Mass Assignment** 취약점을 막으려면 ORM의 `serialize` 메서드에서 허용 필드를 화이트리스트로 명시한다.

## 에러 응답 설계

에러 응답은 공격자에게 정보를 주지 않아야 한다. 스택 트레이스, 내부 파일 경로, DB 쿼리, 프레임워크 버전을 노출하지 않는다.

```json
// 나쁜 예
{"error": "psycopg2.OperationalError: column \"password\" of relation \"users\"..."}

// 좋은 예
{"code": "INTERNAL_ERROR", "message": "요청을 처리할 수 없습니다.", "request_id": "req_abc123"}
```

`request_id`는 서버 내부 로그와 연결해 디버깅에 사용한다. 클라이언트에는 상세 정보 없이, 내부적으로는 완전한 컨텍스트를 유지한다.

## API 인벤토리 관리

보안 팀이 존재조차 모르는 "좀비 API"는 패치도 모니터링도 되지 않아 가장 쉬운 공격 대상이 된다. OpenAPI(Swagger) 스펙을 코드와 동기화하고, API 게이트웨이를 통하지 않는 직접 호출을 차단해 모든 트래픽이 중앙을 통과하도록 강제한다. 더 이상 사용하지 않는 API 버전은 빠르게 폐기한다.

다음 글들에서 REST API 보안 상세, OWASP API Top 10 각 항목, BOLA/BFLA, GraphQL 보안, Rate Limiting 구현을 하나씩 깊이 파고든다.

---

**지난 글:** [시크릿 관리: Vault·AWS Secrets Manager로 자격증명 안전하게 보관하기](/posts/websec-secrets-management/)

**다음 글:** [REST API 보안: 설계부터 배포까지 실전 체크리스트](/posts/websec-rest-api-security/)

<br>
읽어주셔서 감사합니다. 😊
