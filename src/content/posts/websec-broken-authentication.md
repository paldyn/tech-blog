---
title: "취약한 인증 메커니즘 탐구하기"
description: "Broken Authentication의 핵심 결함(취약 비밀번호·무제한 로그인 시도·안전하지 않은 비밀번호 재설정·MFA 부재)과 계정 잠금·타이밍 공격 방어 등 실제 구현 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["BrokenAuthentication", "인증보안", "계정보안", "MFA", "비밀번호재설정", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-insecure-deserialization/)에서 역직렬화 공격의 위험성을 살펴봤다. 이번에는 **취약한 인증(Broken Authentication)** 을 다룬다. 인증은 "당신이 누구인지"를 확인하는 가장 기본적인 보안 메커니즘인데, 잘못 구현하면 시스템 전체가 무너진다.

## 취약한 인증의 흔한 결함

![취약한 인증: 흔한 결함 5가지](/assets/posts/websec-broken-authentication-flaws.svg)

**① 취약한 비밀번호 허용**: `123456`, `password`, `qwerty` 같은 비밀번호를 허용하는 시스템은 크레덴셜 스터핑과 딕셔너리 공격에 취약하다. 매년 수십억 개의 유출된 비밀번호 데이터베이스가 공개된다.

**② 브루트포스 방어 없음**: 로그인 시도에 제한이 없으면 공격자는 자동화 도구로 수천 개의 비밀번호를 초당 시도할 수 있다.

**③ 세션 ID URL 노출**: `https://example.com/dashboard?sessionid=abc123` 형태는 Referer 헤더, 브라우저 히스토리, 서버 로그에 세션 ID가 기록된다.

**④ 안전하지 않은 비밀번호 재설정**: 예측 가능한 토큰, 만료되지 않는 링크, 이메일 주소만 확인하는 절차는 계정 탈취로 이어진다.

**⑤ MFA 미적용**: 비밀번호 하나만으로는 피싱, 크레덴셜 스터핑, 데이터 침해에 취약하다.

## 안전한 인증 구현

![인증 보안 강화 방법](/assets/posts/websec-broken-authentication-fixes.svg)

### 계정 잠금과 점진적 지연

```python
from datetime import datetime, timedelta
import asyncio
import bcrypt

MAX_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

async def login(username: str, password: str) -> dict:
    account = await db.find_user(username)

    if not account:
        # 타이밍 공격 방어: 계정 존재 여부를 노출하지 않음
        await asyncio.sleep(0.3)
        raise AuthError("인증 실패")

    # 계정 잠금 확인
    if account.locked_until and account.locked_until > datetime.utcnow():
        remaining = (account.locked_until - datetime.utcnow()).seconds // 60
        raise AuthError(f"계정 잠금됨. {remaining}분 후 재시도 가능")

    # 비밀번호 검증
    if not bcrypt.checkpw(password.encode(), account.password_hash.encode()):
        account.failed_attempts += 1

        if account.failed_attempts >= MAX_ATTEMPTS:
            account.locked_until = (
                datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            )
            await db.save(account)
            raise AuthError("너무 많은 로그인 시도. 계정이 잠겼습니다")

        await db.save(account)
        raise AuthError("인증 실패")

    # 성공 시 초기화
    account.failed_attempts = 0
    account.locked_until = None
    await db.save(account)

    return create_session(account)
```

### 안전한 비밀번호 재설정

```python
import secrets
from datetime import datetime, timedelta

RESET_TOKEN_EXPIRY_HOURS = 1

async def request_password_reset(email: str) -> None:
    user = await db.find_user_by_email(email)

    # 이메일 존재 여부와 관계없이 동일 응답 (사용자 열거 방지)
    if not user:
        return  # 응답 시간도 일정하게 유지

    # 암호학적으로 안전한 토큰 생성
    token = secrets.token_urlsafe(32)  # 256비트 엔트로피
    expiry = datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRY_HOURS)

    # 토큰의 해시만 DB에 저장 (토큰 자체는 이메일로만 전달)
    import hashlib
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    await db.save_reset_token(user.id, token_hash, expiry)

    await email_service.send_reset_email(user.email, token)

async def reset_password(token: str, new_password: str) -> None:
    import hashlib
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    reset_request = await db.find_reset_token(token_hash)

    if not reset_request:
        raise AuthError("유효하지 않은 토큰")

    if reset_request.expiry < datetime.utcnow():
        await db.delete_reset_token(token_hash)
        raise AuthError("만료된 토큰")

    # 비밀번호 강도 검증
    validate_password_strength(new_password)

    # 새 비밀번호 해싱 후 저장
    new_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt(rounds=12))
    await db.update_password(reset_request.user_id, new_hash.decode())

    # 토큰 즉시 삭제 (단 1회만 사용 가능)
    await db.delete_reset_token(token_hash)

    # 모든 기존 세션 무효화
    await db.invalidate_all_sessions(reset_request.user_id)
```

### 비밀번호 강도 검증

```python
import re
from zxcvbn import zxcvbn  # pip install zxcvbn

def validate_password_strength(password: str) -> None:
    if len(password) < 12:
        raise ValueError("비밀번호는 최소 12자 이상이어야 합니다")

    # zxcvbn: 패턴 기반 강도 분석 (단순 규칙보다 효과적)
    result = zxcvbn(password)
    if result['score'] < 3:  # 0-4 척도, 3 이상 권장
        suggestions = result['feedback']['suggestions']
        raise ValueError(f"비밀번호가 너무 약합니다: {', '.join(suggestions)}")

    # HaveIBeenPwned API로 유출 여부 확인 (선택적)
    # k-anonymity 방식으로 실제 비밀번호를 서버에 보내지 않음
    check_pwned_password(password)
```

### TOTP 기반 MFA

```python
import pyotp

def setup_mfa(user_id: str) -> dict:
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)

    # QR 코드 URI 생성
    qr_uri = totp.provisioning_uri(
        name=f"user_{user_id}",
        issuer_name="MyApp"
    )

    # 시크릿을 암호화하여 DB에 저장
    encrypted_secret = encrypt(secret, app.config['MFA_KEY'])
    db.save_mfa_secret(user_id, encrypted_secret)

    return {'qr_uri': qr_uri, 'backup_codes': generate_backup_codes()}

def verify_mfa(user_id: str, code: str) -> bool:
    encrypted_secret = db.get_mfa_secret(user_id)
    secret = decrypt(encrypted_secret, app.config['MFA_KEY'])
    totp = pyotp.TOTP(secret)

    # valid_window=1: 앞뒤 30초 허용 (클럭 오차 대비)
    return totp.verify(code, valid_window=1)
```

## 세션 관리 모범 사례

```javascript
// Express.js 세션 설정
const session = require('express-session')
const RedisStore = require('connect-redis').default

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,  // 최소 256비트 랜덤
  name: '__Host-sid',      // __Host- 접두사로 도메인 바인딩
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,          // HTTPS만
    httpOnly: true,        // JS 접근 차단
    sameSite: 'strict',    // CSRF 방어
    maxAge: 30 * 60 * 1000 // 30분 비활성 시 만료
  }
}))
```

---

**지난 글:** [안전하지 않은 역직렬화: RCE로 이어지는 위험](/posts/websec-insecure-deserialization/)

**다음 글:** [로깅과 모니터링 실패: 침해를 놓치는 이유](/posts/websec-logging-monitoring-failures/)

<br>
읽어주셔서 감사합니다. 😊
