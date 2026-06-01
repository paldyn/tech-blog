---
title: "SSO(Single Sign-On) 구현과 보안 함정"
description: "OIDC 기반 SSO의 작동 원리, Single Logout(SLO) 구현, 폭발 반경 최소화 전략, Step-up 인증 등 기업 환경 SSO 보안 설계를 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["SSO", "SingleSignOn", "OIDC", "SLO", "기업인증", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-webauthn-passkeys/)에서 WebAuthn으로 피싱 불가능한 인증을 구현하는 방법을 다뤘다. 여러 앱을 운영하는 조직에서는 **SSO(Single Sign-On)**를 통해 한 번 로그인으로 모든 앱에 접근할 수 있게 한다. 편의성이 높지만 보안 설계를 잘못하면 위험이 배가될 수 있다.

## SSO 작동 원리

SSO의 핵심은 **IdP(Identity Provider)**가 중앙 인증을 담당하고, 각 앱(SP, Service Provider)이 IdP를 신뢰하는 구조다. 사용자는 IdP에 한 번만 로그인하면 모든 SP에 자동으로 인증된다.

구현 방식:
- **OIDC 기반**: OpenID Connect로 ID Token을 통해 SSO (현대 표준)
- **SAML 기반**: XML 기반 기업 표준 (레거시, 복잡함)
- **쿠키 기반**: 동일 도메인 내 서브도메인 공유 (한계 있음)

![SSO 흐름과 보안 포인트](/assets/posts/websec-single-sign-on-flow.svg)

## OIDC 기반 SSO 구현

```python
# IdP 서버 측 세션 관리
class IdPSessionManager:
    def create_session(self, user_id: str, db, redis) -> str:
        session_id = secrets.token_urlsafe(32)
        session_data = {
            "user_id": user_id,
            "created_at": time.time(),
            "sp_sessions": [],   # 연결된 SP 세션 목록 (SLO용)
        }
        redis.setex(f"idp_session:{session_id}", 28800, json.dumps(session_data))
        return session_id
    
    def link_sp_session(self, idp_session_id: str, sp_id: str, sp_session_id: str, redis):
        """SP 세션을 IdP 세션에 연결 (SLO를 위해)"""
        data = json.loads(redis.get(f"idp_session:{idp_session_id}"))
        data["sp_sessions"].append({"sp_id": sp_id, "session_id": sp_session_id})
        redis.setex(f"idp_session:{idp_session_id}", 28800, json.dumps(data))
```

### SP 측 구현

![SP 측 세션 검증 코드](/assets/posts/websec-single-sign-on-code.svg)

```python
# SP 백채널 로그아웃 처리 (IdP → SP 로그아웃 알림)
async def backchannel_logout(logout_token: str, db, redis):
    """OIDC Back-Channel Logout 처리"""
    # 로그아웃 토큰 검증
    claims = jwt.decode(
        logout_token,
        jwks,
        algorithms=["RS256"],
        audience=SP_CLIENT_ID,
        issuer=IDP_ISSUER,
    )
    
    if claims.get("events", {}).get(
        "http://schemas.openid.net/event/backchannel-logout"
    ) is None:
        raise ValueError("유효하지 않은 logout token")
    
    # sid(session ID)로 SP 세션 찾아서 모두 폐기
    idp_session_id = claims.get("sid")
    sp_sessions = db.find_sp_sessions_by_idp_session(idp_session_id)
    for sp_session_id in sp_sessions:
        db.delete_session(sp_session_id)
        redis.delete(f"session:{sp_session_id}")
```

## SSO 보안의 핵심 함정

### 1. 폭발 반경(Blast Radius)

SSO의 가장 큰 위험은 IdP가 단일 장애점이라는 점이다. IdP 계정이 탈취되면 연결된 **모든 SP에 대한 접근**이 즉시 노출된다.

완화 방법:
- IdP에 강력한 MFA 적용 (FIDO2 권장)
- 고위험 SP에 Step-up 인증 적용
- IdP 세션 최대 수명 제한 (업무 환경: 8~12시간)
- 이상 행동 탐지: 새 IP, 새 기기, 국가 변경

### 2. Step-up 인증

금융 거래, 비밀번호 변경 등 고위험 작업에서는 SSO 세션이 있어도 재인증을 강제한다.

```python
def require_step_up(min_acr: str = "urn:mfa"):
    """Step-up 인증 미들웨어"""
    async def middleware(request: Request, call_next):
        session = request.session
        acr = session.get("acr_values", "urn:password")
        
        # MFA 수준이 충분하지 않으면 재인증
        if acr_level(acr) < acr_level(min_acr):
            request.session["required_acr"] = min_acr
            request.session["post_auth_redirect"] = str(request.url)
            return RedirectResponse("/auth/step-up")
        
        return await call_next(request)
    return middleware

# 금융 거래 라우터에 적용
@router.post("/transfer", dependencies=[Depends(require_step_up("urn:mfa"))])
async def transfer_funds(request: Request):
    ...
```

### 3. SP별 권한 격리

각 SP는 자신에게 필요한 scope만 요청해야 한다. IdP에서 SP별 권한을 명시적으로 제한한다.

```python
SP_ALLOWED_SCOPES = {
    "hr-app":      {"openid", "email", "profile", "hr.read"},
    "finance-app": {"openid", "email", "finance.read", "finance.write"},
    "blog-app":    {"openid", "email"},
}

def validate_sp_scopes(sp_id: str, requested_scopes: set) -> set:
    allowed = SP_ALLOWED_SCOPES.get(sp_id, {"openid"})
    return requested_scopes & allowed  # 허용된 scope만 발급
```

## 기업 환경 고려사항

### 프로비저닝과 디프로비저닝

```python
# SCIM 프로토콜 기반 자동 계정 관리
async def deprovision_user(user_id: str, db, redis):
    """퇴사 처리: 모든 SP 세션 즉시 종료"""
    # 1. IdP 계정 비활성화
    db.deactivate_user(user_id)
    
    # 2. 활성 SSO 세션 모두 폐기
    sessions = db.get_all_user_sessions(user_id)
    for session in sessions:
        redis.delete(f"idp_session:{session['id']}")
        for sp_session in session["sp_sessions"]:
            await notify_sp_logout(sp_session["sp_id"], sp_session["session_id"])
    
    # 3. 감사 로그
    audit_log(user_id, "deprovisioned", actor=request.user)
```

## 보안 체크리스트

- [ ] IdP에 강력한 MFA 적용 (FIDO2 우선)
- [ ] IdP 세션 최대 수명 제한 (8~12시간)
- [ ] SLO 구현 (백채널 로그아웃)
- [ ] SP별 scope 명시적 제한
- [ ] 고위험 작업 Step-up 인증
- [ ] IdP 이상 탐지 (새 IP, 새 기기)
- [ ] 퇴사자 즉시 디프로비저닝

---

**지난 글:** [WebAuthn과 패스키](/posts/websec-webauthn-passkeys/)

**다음 글:** [RBAC: 역할 기반 접근 제어](/posts/websec-rbac/)

<br>
읽어주셔서 감사합니다. 😊
