---
title: "인증과 인가의 차이"
description: "Authentication(인증)과 Authorization(인가)의 개념적 차이, 각 단계의 취약점, 그리고 두 개념을 혼동했을 때 발생하는 IDOR 같은 보안 취약점을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "Security"
tags: ["인증", "인가", "Authentication", "Authorization", "IDOR", "RBAC"]
featured: false
draft: false
---

[지난 글](/posts/websec-http-security-basics/)에서 HTTP 프로토콜의 보안 기초를 다뤘다. 이번 글부터는 2부 인증과 인가를 본격적으로 시작한다. **인증(Authentication)**과 **인가(Authorization)**는 영어권에서도 종종 혼용되지만, 보안에서 이 두 개념의 혼동은 심각한 취약점을 만든다.

## 두 개념의 정의

**인증(Authentication, AuthN)**: "당신이 누구인가?"를 확인하는 과정이다. 신원을 증명한다. 로그인 성공은 인증이 완료됐다는 의미다.

**인가(Authorization, AuthZ)**: "당신이 무엇을 할 수 있는가?"를 결정하는 과정이다. 권한을 확인한다. 인증된 사용자가 특정 자원에 접근할 권한이 있는지 결정한다.

두 단계는 순차적이다. 인증 없이 인가할 수 없고, 인증됐다고 해서 모든 것을 인가받은 것이 아니다.

![인증 vs 인가 비교](/assets/posts/websec-authn-authz-comparison.svg)

## 인증의 요소

인증은 세 가지 요소 중 하나 이상의 조합으로 이루어진다.

**지식 요소(Knowledge)**: 알고 있는 것. 비밀번호, PIN, 보안 질문. 유출 가능성이 가장 높다.

**소유 요소(Possession)**: 가지고 있는 것. OTP 기기, 스마트폰 앱(Google Authenticator), 하드웨어 키(YubiKey). 탈취가 어렵지만 분실 가능.

**존재 요소(Inherence)**: 본인 자체. 지문, 얼굴 인식, 홍채. 변경 불가능하므로 유출 시 영구적 위험.

```python
# 인증: 세 요소를 조합한 MFA
def authenticate(username: str, password: str, otp_code: str) -> bool:
    user = User.get_by_username(username)
    if not user:
        return False  # 사용자 열거 방지: 동일한 응답

    # 지식 요소: bcrypt 해시 검증
    if not bcrypt.verify(password, user.password_hash):
        return False

    # 소유 요소: TOTP 검증
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(otp_code, valid_window=1):
        return False

    return True  # 인증 성공 → 세션 발급
```

## 인가의 모델

인증 이후의 인가는 별도의 로직이 필요하다. 대표적인 두 모델을 살펴본다.

### RBAC (역할 기반 접근 제어)

사용자에게 역할(Role)을 부여하고, 역할에 권한(Permission)을 연결한다. 간단하고 관리하기 쉬워 대부분의 웹 애플리케이션에 적합하다.

```python
# RBAC 구현
from enum import Enum
from functools import wraps

class Role(Enum):
    USER = "user"
    MODERATOR = "moderator"
    ADMIN = "admin"

PERMISSIONS = {
    Role.USER: {"read_own_profile", "create_post"},
    Role.MODERATOR: {"read_own_profile", "create_post", "delete_any_post"},
    Role.ADMIN: {"*"},  # 모든 권한
}

def require_permission(permission: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user_role = Role(current_user.role)
            allowed = PERMISSIONS.get(user_role, set())
            if "*" not in allowed and permission not in allowed:
                abort(403)
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/admin/users")
@login_required
@require_permission("manage_users")
def admin_users():
    return User.all()
```

### ABAC (속성 기반 접근 제어)

더 세밀한 제어가 필요할 때 사용한다. 사용자, 자원, 환경의 속성을 모두 고려해 접근 여부를 결정한다.

```python
# ABAC: "오전 9시~오후 6시, 회사 IP에서만 HR 데이터 접근 허용"
def can_access_hr_data(user, resource, environment):
    checks = [
        user.department == "HR" or user.role == "admin",
        environment.ip in CORPORATE_IP_RANGE,
        9 <= environment.hour < 18,
        resource.classification != "TOP_SECRET" or user.clearance_level >= 3,
    ]
    return all(checks)
```

## 가장 흔한 실수: 인증만 확인

![인가 미구현 취약점과 수정](/assets/posts/websec-authn-authz-code.svg)

**수직적 권한 이탈(Vertical Privilege Escalation)**: 일반 사용자가 관리자 기능에 접근하는 경우. 예: 관리자 전용 API에 인증만 있고 역할 확인이 없는 경우.

**수평적 권한 이탈(Horizontal Privilege Escalation)**: 같은 권한 레벨에서 다른 사용자의 데이터에 접근하는 경우. 이것이 IDOR(Insecure Direct Object Reference)의 핵심이다.

```python
# 취약: URL의 ID로 직접 접근
@app.route("/invoice/<int:invoice_id>")
@login_required
def get_invoice(invoice_id):
    # 인증만 확인, 소유권 미확인
    return Invoice.get(invoice_id)  # IDOR!

# 안전: 현재 사용자의 청구서만 반환
@app.route("/invoice/<int:invoice_id>")
@login_required
def get_invoice_safe(invoice_id):
    invoice = Invoice.query.filter_by(
        id=invoice_id,
        user_id=current_user.id  # 소유권 강제
    ).first_or_404()
    return invoice
```

## 실무 구현 체크리스트

인증과 인가를 올바르게 구현하기 위한 체크리스트다.

**인증 체크리스트**:
- 모든 민감 엔드포인트에 인증 미들웨어가 적용됐는가?
- 브루트 포스 방지(레이트 리미팅, 계정 잠금)가 있는가?
- 비밀번호는 bcrypt·argon2로 해싱되는가?
- 인증 실패 응답이 사용자 열거를 허용하지 않는가? (동일한 메시지)

**인가 체크리스트**:
- 데이터 접근 시 소유권(owner 확인)이 모두 구현됐는가?
- 역할 확인이 미들웨어에서만 이뤄지고 개별 뷰에는 없는 경우가 없는가?
- 관리자 기능이 역할 기반으로 보호되는가?
- API 응답에 현재 사용자가 볼 수 없는 필드가 포함되지 않는가?

인증은 문을 여는 열쇠다. 인가는 열쇠로 열 수 있는 방의 목록이다. 둘 다 없으면 보안이 없다.

---

**지난 글:** [HTTP 프로토콜과 보안 기초](/posts/websec-http-security-basics/)

**다음 글:** [비밀번호 해싱(bcrypt·argon2)](/posts/websec-password-hashing/)

<br>
읽어주셔서 감사합니다. 😊
