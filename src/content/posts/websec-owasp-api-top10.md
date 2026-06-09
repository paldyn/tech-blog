---
title: "OWASP API Security Top 10: 현실 공격 시나리오와 방어 코드"
description: "OWASP API Security Top 10(2023) 10개 항목을 실제 공격 시나리오·방어 코드와 함께 다룹니다. BOLA, 인증 실패, Mass Assignment, Rate Limiting, SSRF, 좀비 API 방어까지."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["OWASP", "APITop10", "BOLA", "BFLA", "RateLimiting", "SSRF", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-rest-api-security/)에서 REST API 보안 기초를 다뤘다. 이번 글은 OWASP API Security Top 10(2023 버전)의 10개 항목을 실제 공격 시나리오와 방어 코드 중심으로 깊이 살펴본다. API 보안 취약점의 약 80%가 이 10개 범주 안에 포함된다.

![OWASP API Security Top 10 (2023)](/assets/posts/websec-owasp-api-top10-overview.svg)

## API1 — BOLA: Broken Object Level Authorization

가장 흔하고 파급력이 큰 취약점이다. 인증(로그인)은 했지만 특정 자원에 대한 접근 권한(인가)을 검사하지 않는 경우다.

![BOLA / BFLA 공격 시나리오와 방어](/assets/posts/websec-owasp-api-attack-flow.svg)

```python
# 취약: ID만으로 자원 반환
GET /api/invoices/5678  → 5679로 바꾸면 타인 청구서 접근 가능

# 방어: 쿼리에 소유자 조건 포함
invoice = Invoice.objects.get(pk=pk, organization=request.user.organization)
```

방어의 핵심은 ORM 쿼리에 `AND owner = current_user` 조건을 항상 포함하는 것이다. 인증 미들웨어와 비즈니스 로직을 분리해, 비즈니스 계층에서 다시 한번 검증한다.

## API2 — Broken Authentication

JWT `alg:none` 공격, 만료 토큰 허용, 약한 비밀키, 리프레시 토큰 무효화 미구현이 대표적이다. 이전 JWT 보안 글에서 상세히 다뤘으므로 핵심만 정리한다.

```python
# 필수 검증 항목
payload = jwt.decode(
    token,
    secret,
    algorithms=["HS256"],          # alg 명시 필수
    options={"require": ["exp", "iat", "sub"]}
)
# 추가: 로그아웃된 토큰 블랙리스트 확인
if redis.get(f"blacklist:{payload['jti']}"):
    raise HTTPException(status_code=401)
```

## API3 — Broken Object Property Level Authorization

Mass Assignment(일괄 속성 할당)와 과도한 데이터 노출이 이 항목에 해당한다. 요청 바디의 모든 필드를 ORM에 그대로 전달하면 `role: "admin"`, `is_premium: true` 같은 권한 필드도 변경된다.

```javascript
// 취약: req.body를 그대로 update
await User.findByIdAndUpdate(userId, req.body);

// 방어: 허용 필드만 추출
const allowedFields = pick(req.body, ["name", "bio", "avatar"]);
await User.findByIdAndUpdate(userId, allowedFields);
```

## API4 — Unrestricted Resource Consumption

Rate Limit이 없거나 쿼리 크기 제한이 없으면 단일 클라이언트가 서버 자원 전체를 소비할 수 있다. AI/ML API에서 특히 위험하다 — 무제한 요청으로 비용이 기하급수적으로 증가한다.

```nginx
# nginx: 요청 크기 + 속도 제한
client_max_body_size 1m;          # 요청 바디 최대 1MB
client_body_timeout 10s;           # 느린 POST 공격 방어

limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
limit_req zone=api burst=50 nodelay;
limit_req_status 429;
```

## API5 — BFLA: Broken Function Level Authorization

기능 수준 인가 실패다. 관리자 전용 API를 UI에서만 숨기고 서버에서 권한을 확인하지 않으면, 직접 API 호출로 우회할 수 있다.

```python
# 취약: 관리자 UI에서만 숨김
@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, current_user: User = Depends(get_current_user)):
    # 권한 확인 없음!
    db.delete(user_id)

# 방어: 서버 측 역할 검증
@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, current_user: User = Depends(require_admin)):
    db.delete(user_id)
```

## API6 — Unrestricted Access to Sensitive Business Flows

비즈니스 로직을 자동화로 악용하는 공격이다. 티켓 구매 봇, 쿠폰 대량 발급, 재고 선점이 대표적이다.

```python
# 방어: CAPTCHA + 동작 기반 이상 감지
@app.post("/api/checkout")
async def checkout(req: CheckoutRequest, current_user: User = ...):
    # 최근 1시간 내 주문 횟수 확인
    recent_orders = redis.incr(f"orders:{current_user.id}:hourly")
    redis.expire(f"orders:{current_user.id}:hourly", 3600)
    if recent_orders > 10:
        raise HTTPException(status_code=429, detail="Too many orders")
    # CAPTCHA 토큰 검증
    verify_captcha(req.captcha_token)
```

## API7 — SSRF (Server Side Request Forgery)

API가 URL을 파라미터로 받아 서버 측에서 해당 URL에 요청하는 경우 발생한다.

```python
# 취약
@app.post("/api/fetch-url")
async def fetch_url(url: str):
    return requests.get(url).content  # 내부 서비스 접근 가능!

# 방어: 허용 도메인 화이트리스트
import ipaddress
from urllib.parse import urlparse

ALLOWED_HOSTS = {"api.partner.com", "cdn.example.com"}

def safe_fetch(url: str):
    parsed = urlparse(url)
    if parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError("Blocked host")
    # 내부 IP 범위 차단
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        if ip.is_private or ip.is_loopback:
            raise ValueError("Private IP blocked")
    except ValueError:
        pass  # 도메인은 통과 (위에서 화이트리스트 검사)
    return requests.get(url, timeout=5)
```

## API8 — Security Misconfiguration

디버그 모드 활성화, CORS `*`, 기본 자격증명, 불필요한 HTTP 메서드 허용, 상세 에러 메시지가 해당한다.

```python
# FastAPI 프로덕션 설정
app = FastAPI(
    debug=False,                           # 디버그 모드 비활성화
    docs_url=None,                         # Swagger UI 비공개
    redoc_url=None,
    openapi_url="/api/openapi.json" if IS_INTERNAL else None,
)

@app.exception_handler(Exception)
async def generic_handler(req, exc):
    # 내부 오류 상세 숨김
    return JSONResponse({"code": "INTERNAL_ERROR"}, status_code=500)
```

## API9 — Improper Inventory Management

문서화되지 않은 "좀비 API", 구버전 API(`/api/v1/`을 폐기하지 않고 `/api/v2/`를 추가)가 주요 위험이다.

```bash
# API 인벤토리 자동 생성 (Swagger/OpenAPI)
# 모든 활성 엔드포인트를 스펙에 포함

# 구버전 API 자동 탐지 (API 게이트웨이 로그 분석)
cat access.log | awk '{print $7}' | grep -E '^/api/v[0-9]+' \
  | sort | uniq -c | sort -rn | head -20
```

## API10 — Unsafe Consumption of APIs

자체 API 보안만 신경 쓰고, 연동하는 서드파티 API 응답을 그대로 신뢰하는 경우다. 서드파티가 침해되거나 데이터를 변조하면 자신의 서비스도 영향받는다.

```python
# 서드파티 API 응답 검증
def safe_parse_payment_response(response: dict) -> PaymentResult:
    # 스키마 검증 — 예상치 못한 필드 무시
    return PaymentResult(
        transaction_id=str(response.get("txn_id", "")),
        amount=float(response.get("amount", 0)),  # 형 변환 명시
        status=PaymentStatus(response.get("status", "unknown"))  # 열거형 검증
    )
    # response를 직접 DB에 저장하거나 HTML에 삽입하지 않는다
```

OWASP API Top 10은 코드 검토 시 체크리스트로 사용하고, 자동화 스캐너(OWASP ZAP, Burp Suite, 42Crunch)를 CI에 통합해 회귀를 방지하는 것이 실무 접근법이다.

---

**지난 글:** [REST API 보안: 설계부터 배포까지 실전 체크리스트](/posts/websec-rest-api-security/)

**다음 글:** [BOLA와 BFLA 심층 분석: 객체·기능 수준 권한 실패 완전 해부](/posts/websec-bola-bfla/)

<br>
읽어주셔서 감사합니다. 😊
