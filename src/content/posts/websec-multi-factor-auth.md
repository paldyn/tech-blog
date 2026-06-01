---
title: "다중 인증(MFA): SMS부터 패스키까지"
description: "SMS OTP, TOTP, FIDO2/WebAuthn 등 MFA 방식의 보안 강도를 비교하고, TOTP 완전 구현과 MFA 우회 공격(피싱, SIM Swap, MFA Fatigue) 방어 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["MFA", "TOTP", "FIDO2", "다중인증", "패스키", "SMS인증"]
featured: false
draft: false
---

[지난 글](/posts/websec-openid-connect/)에서 OIDC로 사용자 인증을 표준화하는 방법을 다뤘다. 비밀번호 하나만으로는 부족하다. 피싱, 크리덴셜 스터핑, 데이터 유출 등 다양한 경로로 비밀번호가 노출될 수 있다. **다중 인증(MFA)**은 두 번째 인증 요소를 추가해 계정 탈취를 대폭 어렵게 만든다.

## MFA의 세 가지 요소

- **지식 (Know)**: 비밀번호, PIN
- **소지 (Have)**: 인증 앱, 하드웨어 키, 전화기
- **특성 (Are)**: 지문, 얼굴 인식

MFA는 서로 다른 카테고리의 요소를 **두 가지 이상** 조합한다. 같은 카테고리를 두 번 쓰는 것(비밀번호 + PIN)은 MFA가 아니다.

## MFA 방식 비교

![MFA 방식 비교](/assets/posts/websec-multi-factor-auth-types.svg)

### SMS OTP — 지양

SIM Swap 공격, SS7 프로토콜 취약점, 실시간 피싱에 취약하다. NIST SP 800-63B는 SMS OTP를 "제한된 인증자"로 분류한다. 기존 사용자 기반을 위해 제공할 수 있지만, 더 강한 방식으로 이전을 권장해야 한다.

### TOTP(시간 기반 OTP) — 현재 표준

Google Authenticator, Microsoft Authenticator 등 앱에서 30초마다 6자리 코드를 생성한다. RFC 6238 표준이며 구현이 간단하다. 단, 실시간 피싱에는 여전히 취약하다(공격자가 OTP를 즉시 릴레이).

### FIDO2/WebAuthn — 최강

공개키 암호화 기반. 서버는 공개키만 보관하고, 개인키는 하드웨어 기기나 생체 인증기에서 절대 벗어나지 않는다. **도메인 바인딩**으로 피싱 사이트에서는 절대 인증할 수 없다. 현재 가장 강력한 MFA 방식이다.

## TOTP 완전 구현

![TOTP 구현 코드](/assets/posts/websec-multi-factor-auth-totp.svg)

```python
import pyotp
import secrets
import hashlib

# 등록
def setup_totp(user_id: str, db) -> dict:
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    
    # QR 코드 URI — Authenticator 앱에 스캔
    uri = totp.provisioning_uri(user_id, issuer_name="MyApp")
    
    # 백업 코드 생성 (10개)
    backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
    hashed_codes = [hashlib.sha256(c.encode()).hexdigest() for c in backup_codes]
    
    # 아직 DB 저장하지 말 것 — 사용자가 확인 후 저장
    return {
        "secret": secret,          # 임시 보관 (확인 후 DB 저장)
        "qr_uri": uri,
        "backup_codes": backup_codes,  # 사용자에게 한 번만 표시
        "hashed_codes": hashed_codes,
    }

# 등록 확인: 사용자가 OTP 입력으로 정상 등록 확인
def confirm_totp_setup(user_id: str, code: str, pending_secret: str, db) -> bool:
    totp = pyotp.TOTP(pending_secret)
    if not totp.verify(code, valid_window=1):
        return False
    
    # 검증 완료 후 DB에 저장
    db.save_totp_secret(user_id, pending_secret)
    return True

# 로그인 시 검증
def verify_totp(user_id: str, code: str, db) -> bool:
    secret = db.get_totp_secret(user_id)
    if not secret:
        raise ValueError("TOTP 미등록")
    
    totp = pyotp.TOTP(secret)
    
    # valid_window=1: 이전/다음 30초 윈도우 허용 (시계 오차 대비)
    if not totp.verify(code, valid_window=1):
        # 백업 코드 시도
        return verify_backup_code(user_id, code, db)
    
    # 코드 재사용 방지: 이미 사용한 코드 기록
    if db.is_totp_code_used(user_id, code):
        raise ValueError("이미 사용된 OTP")
    db.mark_totp_code_used(user_id, code, ttl_seconds=90)
    return True
```

## MFA 상태 관리

MFA 검증 후 세션에 단계를 기록한다.

```python
class LoginStep(str, Enum):
    PASSWORD_VERIFIED = "password_verified"
    MFA_VERIFIED = "mfa_verified"

async def login_step2_mfa(code: str, request: Request):
    # 1단계(비밀번호) 완료 확인
    if request.session.get("login_step") != LoginStep.PASSWORD_VERIFIED:
        raise HTTPException(401, "비밀번호 인증 먼저 필요")
    
    user_id = request.session["pending_user_id"]
    
    if not verify_totp(user_id, code, db):
        raise HTTPException(401, "OTP 인증 실패")
    
    # MFA 완료 — 완전한 세션 생성
    request.session["user_id"] = user_id
    request.session["login_step"] = LoginStep.MFA_VERIFIED
    del request.session["pending_user_id"]
    
    return {"message": "로그인 완료"}
```

## MFA Fatigue 공격 방어

Push 알림 기반 MFA에서 공격자가 반복적으로 승인 요청을 보내 사용자가 지쳐 수락하는 공격이다.

```python
MFA_REQUEST_LIMIT = 3  # 10분 내 최대 요청
MFA_LOCKOUT_SECONDS = 600

def check_mfa_rate_limit(user_id: str, redis_client):
    key = f"mfa_attempts:{user_id}"
    count = redis_client.incr(key)
    if count == 1:
        redis_client.expire(key, MFA_LOCKOUT_SECONDS)
    if count > MFA_REQUEST_LIMIT:
        raise RateLimitError("MFA 요청 횟수 초과 — 잠시 후 다시 시도")
```

## 보안 체크리스트

- [ ] TOTP: 백업 코드 10개 제공 및 안전한 보관 안내
- [ ] OTP 코드 재사용 방지 (30~90초 TTL로 사용 기록)
- [ ] MFA 실패 횟수 제한 (5회 실패 시 계정 잠금)
- [ ] MFA 설정 변경 시 재인증 요구
- [ ] 가능하면 FIDO2/WebAuthn 제공 (피싱 저항)
- [ ] SMS OTP: 더 강한 방식 이전 권유

---

**지난 글:** [OpenID Connect](/posts/websec-openid-connect/)

**다음 글:** [WebAuthn과 패스키: 비밀번호 없는 미래](/posts/websec-webauthn-passkeys/)

<br>
읽어주셔서 감사합니다. 😊
