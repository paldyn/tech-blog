---
title: "REST API 보안: 설계부터 배포까지 실전 체크리스트"
description: "HTTP 메서드별 취약점, JWT 인증 미들웨어, BOLA/Mass Assignment 방어, 입력 검증, 에러 처리, CORS 설정, OpenAPI 스펙 기반 보안 테스트를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["REST", "API보안", "JWT", "BOLA", "MassAssignment", "CORS", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-api-security-overview/)에서 API 보안의 전체 계층 구조를 살펴봤다. 이번 글에서는 현장에서 가장 많이 사용되는 REST API에 집중해, 설계 단계부터 배포까지 실제로 적용하는 보안 체크리스트를 만들어본다.

## HTTP 메서드별 보안 고려사항

REST는 HTTP 메서드의 의미 체계를 활용해 자원을 조작한다. 각 메서드는 서로 다른 보안 속성과 취약점을 가진다.

![REST API 보안: HTTP 메서드별 취약점과 방어](/assets/posts/websec-rest-api-methods.svg)

가장 중요한 원칙은 **GET 요청은 상태를 변경하지 않아야 한다**는 것이다. GET으로 삭제나 결제 처리를 하면 CSRF 공격에 직접 노출된다. 또한 PUT은 전체 대체, PATCH는 부분 수정이라는 의미론을 지키면 권한 범위를 명확히 정의할 수 있다.

## JWT 인증 미들웨어 구현

![REST API 인증 흐름 및 토큰 검증](/assets/posts/websec-rest-api-auth-flow.svg)

JWT 인증에서 가장 흔한 실수는 **알고리즘 검증 생략**이다. `{"alg": "none"}` 공격이나 RS256을 HS256으로 다운그레이드하는 알고리즘 혼동 공격을 막으려면 허용 알고리즘을 명시해야 한다.

```python
# Python (PyJWT) 안전한 JWT 검증
import jwt

def verify_jwt(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],       # 허용 알고리즘 명시
            options={"require": ["exp", "iat", "sub"]}  # 필수 클레임
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

## BOLA(Broken Object Level Authorization) 방어

OWASP API Top 10 1위를 3년 연속 차지한 취약점이다. `/api/orders/1234` 같은 엔드포인트에서 ID만 바꾸면 타인의 주문에 접근할 수 있는 경우다.

```python
# 취약한 코드
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, current_user: User = Depends(get_current_user)):
    return db.get(Order, order_id)  # 소유자 확인 없음!

# 안전한 코드
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, current_user: User = Depends(get_current_user)):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id  # 소유자 검증
    ).first()
    if not order:
        raise HTTPException(status_code=404)  # 403 대신 404 (열거 방지)
    return order
```

404를 반환하는 이유가 중요하다. 403은 "존재하지만 권한 없음"을 알려줘 공격자가 유효한 ID를 열거할 수 있다. 404는 존재 여부 자체를 감춘다.

## Mass Assignment 방어

ORM의 자동 필드 매핑이 공격자가 권한 없는 필드(예: `is_admin`, `role`, `credit_balance`)를 직접 변경하게 허용하는 취약점이다.

```python
# 취약한 FastAPI 코드
class UpdateUserRequest(BaseModel):
    pass  # 아무 필드나 받음

@app.put("/users/{user_id}")
async def update_user(user_id: int, data: dict, ...):
    user.update(**data)  # is_admin=true 포함해서 업데이트!

# 안전한 코드: 명시적 화이트리스트
class UpdateUserRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    # is_admin, role 등 민감 필드는 없음

@app.put("/users/{user_id}")
async def update_user(user_id: int, data: UpdateUserRequest, ...):
    allowed_fields = data.model_dump(exclude_none=True)
    user.update(**allowed_fields)
```

## CORS 보안 설정

CORS의 `Access-Control-Allow-Origin: *`는 API 서버에서는 거의 항상 잘못된 설정이다. 자격증명(쿠키, Authorization 헤더)과 함께 사용할 수 없고, 모든 오리진에서의 JavaScript 접근을 허용한다.

```python
# FastAPI CORS 화이트리스트 설정
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = [
    "https://app.example.com",
    "https://admin.example.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,  # Preflight 캐시
)
```

개발 환경에서 편의상 `*`를 허용하다 프로덕션에도 그대로 배포하는 실수가 많다. 환경변수로 오리진 목록을 관리하고 프로덕션 배포 시 검증하도록 CI에 포함한다.

## OpenAPI 스펙 기반 보안 테스트

API 스펙을 직접 보안 테스트 도구에 연결하면 새 엔드포인트가 추가될 때마다 자동으로 커버리지가 확장된다.

```bash
# OWASP ZAP API 스캔 (CI/CD 연동)
docker run -v $(pwd):/zap/wrk:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py \
  -t http://api:8000/openapi.json \
  -f openapi \
  -r api-security-report.html \
  -x api-security-report.xml

# 42crunch API Security Audit (스펙 정적 분석)
npx api-security-audit --file openapi.yaml \
  --min-score 70
```

REST API 보안은 "한 번 검토하고 끝"이 아니다. API 스펙을 항상 최신 상태로 유지하고, 새 엔드포인트마다 BOLA·Mass Assignment·인가 로직을 코드 리뷰에 포함하며, 자동화 보안 스캔을 CI 파이프라인에 통합하는 것이 지속 가능한 보안 운영의 핵심이다.

---

**지난 글:** [API 보안 개요: REST·GraphQL·gRPC API를 안전하게 설계하는 원칙](/posts/websec-api-security-overview/)

**다음 글:** [OWASP API Security Top 10: 현실 공격 시나리오와 방어 코드](/posts/websec-owasp-api-top10/)

<br>
읽어주셔서 감사합니다. 😊
