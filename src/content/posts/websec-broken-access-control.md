---
title: "Broken Access Control: 접근 제어 취약점 — OWASP Top 1위"
description: "OWASP Top 10 2021 1위인 접근 제어 취약점의 6가지 유형(IDOR, 권한 상승, 경로 순회 등), 취약한 코드 패턴, RBAC 미들웨어와 소유자 검증으로 방어하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "Security"
tags: ["Broken Access Control", "IDOR", "OWASP", "RBAC", "권한 상승", "웹 보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-ssrf-cloud-metadata/)에서 SSRF를 통한 클라우드 메타데이터 탈취를 살펴봤습니다. 이번 글에서는 **OWASP Top 10 2021에서 1위를 차지한 Broken Access Control(접근 제어 취약점)**을 다룹니다. OWASP 데이터에 따르면 테스트된 애플리케이션의 94%에서 이 취약점이 발견될 만큼 만연합니다.

## 접근 제어란?

접근 제어는 **인증된 사용자가 자신이 허용된 범위 내에서만 행동할 수 있도록** 제한하는 메커니즘입니다. "누구인지"를 확인하는 인증(Authentication)과 달리, "무엇을 할 수 있는지"를 제어하는 인가(Authorization)가 접근 제어의 핵심입니다.

Broken Access Control은 이 인가 로직이 누락되거나 잘못 구현된 경우를 총칭합니다.

![Broken Access Control: 주요 유형](/assets/posts/websec-broken-access-control-types.svg)

## 6가지 주요 취약점 유형

**① IDOR (Insecure Direct Object Reference)**: 사용자 입력으로 받은 식별자(ID)를 소유자 검증 없이 직접 DB 조회에 사용합니다. 가장 흔히 발견되는 패턴입니다.

**② 수평/수직 권한 상승**: 수평 권한 상승은 같은 권한 레벨의 다른 사용자 리소스에 접근하는 것, 수직 권한 상승은 더 높은 권한(관리자)으로 격상하는 것입니다.

**③ 경로 순회**: `../`를 이용해 허용된 디렉토리 밖의 파일에 접근합니다.

**④ 기능 수준 접근 제어 누락**: UI에서 관리자 메뉴를 숨겼지만 API 엔드포인트에는 권한 검사가 없습니다.

**⑤ 질량 할당**: ORM 프레임워크에서 사용자가 전송한 모든 필드를 모델에 바인딩할 때 `role`, `isAdmin` 같은 민감 필드도 함께 수정됩니다.

**⑥ 메타데이터 조작**: JWT 서명을 검증하지 않거나 쿠키 값을 서버에서 재검증하지 않아 권한을 위조할 수 있습니다.

## IDOR 취약점 상세

```python
# Django (취약)
@login_required
def get_invoice(request, invoice_id):
    # ❌ invoice_id가 현재 사용자 것인지 확인 안 함
    invoice = Invoice.objects.get(id=invoice_id)
    return JsonResponse(invoice.to_dict())

# Django (안전)
@login_required
def get_invoice(request, invoice_id):
    # ✅ 현재 사용자의 인보이스만 조회
    try:
        invoice = Invoice.objects.get(id=invoice_id, user=request.user)
    except Invoice.DoesNotExist:
        return HttpResponse(status=404)  # 403 대신 404로 존재 자체를 숨김
    return JsonResponse(invoice.to_dict())
```

예측 가능한 순차 ID(1, 2, 3...) 대신 UUID를 사용하면 IDOR 탐지를 어렵게 만들 수 있지만, 소유자 검증을 대체하지는 않습니다:

```python
import uuid
# 순차 ID 대신 UUID 사용
class Invoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    # ...
```

## 접근 제어 구현 패턴

![접근 제어 구현 패턴](/assets/posts/websec-broken-access-control-fix.svg)

**RBAC 미들웨어**: 역할 기반 접근 제어를 재사용 가능한 미들웨어로 구현합니다.

```python
# Python Flask RBAC 데코레이터
from functools import wraps
from flask import g, jsonify

def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not g.current_user:
                return jsonify({'error': 'Unauthorized'}), 401
            if g.current_user.role not in roles:
                return jsonify({'error': 'Forbidden'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

@app.route('/admin/users')
@require_role('admin', 'superadmin')
def list_users():
    return jsonify(User.query.all())
```

**질량 할당 방어**:

```python
# Django — 허용 필드 명시
class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # ✅ 수정 가능한 필드만 명시
        fields = ['name', 'email', 'bio']
        # role, is_staff, is_superuser는 제외

# Rails — Strong Parameters
def user_params
  params.require(:user).permit(:name, :email, :bio)
  # role은 포함하지 않음
end
```

**경로 순회 방어**:

```python
import os

def safe_file_access(filename: str, base_dir: str) -> str:
    # 절대 경로로 정규화
    real_base = os.path.realpath(base_dir)
    requested = os.path.realpath(os.path.join(base_dir, filename))
    
    # base_dir 밖을 벗어나는지 검사
    if not requested.startswith(real_base + os.sep):
        raise ValueError('경로 순회 시도 감지')
    
    return requested
```

## 접근 제어 설계 원칙

**기본 거부(Deny by Default)**: 명시적으로 허용되지 않은 모든 접근은 거부합니다.

```python
# 명시적 허용 목록 (화이트리스트)
ALLOWED_ACTIONS = {
    'admin': ['read', 'write', 'delete', 'manage_users'],
    'editor': ['read', 'write'],
    'viewer': ['read'],
}

def can(user, action):
    return action in ALLOWED_ACTIONS.get(user.role, [])
```

**모든 계층에서 검증**: 프론트엔드(UI 숨김)만이 아니라 API, 서비스 레이어, DB 쿼리까지 모든 계층에서 권한을 검증합니다.

**감사 로깅**: 민감한 리소스 접근, 권한 거부 이벤트를 모두 로깅합니다.

```python
import logging

security_logger = logging.getLogger('security')

def get_order(request, order_id):
    order = Order.objects.filter(id=order_id, user=request.user).first()
    if not order:
        # 403 대신 404 — 자원 존재 여부 노출 방지
        security_logger.warning(
            f'Access denied: user={request.user.id} tried order={order_id}'
        )
        return HttpResponse(status=404)
    return JsonResponse(order.to_dict())
```

## 자동화 테스트

접근 제어 취약점은 수동 테스트만으로 찾기 어렵습니다. 테스트 케이스를 코드로 작성해 CI/CD 파이프라인에 포함합니다:

```python
# pytest — IDOR 테스트
def test_idor_prevention(client):
    user_a = create_user('alice')
    user_b = create_user('bob')
    order = create_order(user=user_a)
    
    # Bob이 Alice의 주문 접근 시도
    client.force_login(user_b)
    response = client.get(f'/api/orders/{order.id}/')
    
    assert response.status_code == 404  # 403도 가능하나 404가 더 안전
```

접근 제어는 "한 번 구현하고 끝"이 아닙니다. 새 기능을 추가할 때마다 권한 검사를 빠뜨리지 않았는지 코드 리뷰와 테스트로 지속적으로 검증해야 합니다.

---

**지난 글:** [SSRF와 클라우드 메타데이터: AWS/GCP/Azure 자격증명 탈취](/posts/websec-ssrf-cloud-metadata/)

**다음 글:** [IDOR: 불안전한 직접 객체 참조 완전 분석](/posts/websec-idor/)

<br>
읽어주셔서 감사합니다. 😊
