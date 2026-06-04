---
title: "로깅과 모니터링 실패: 침해를 놓치는 이유"
description: "보안 로깅 부재가 어떻게 침해 탐지를 수십 일 지연시키는지, 구조화된 보안 이벤트 로깅·실시간 알림·SIEM 통합의 실제 구현 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["보안로깅", "모니터링", "SIEM", "침해탐지", "감사로그", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-broken-authentication/)에서 취약한 인증 메커니즘을 살펴봤다. 이번에는 OWASP Top 10의 마지막 항목인 **로깅 및 모니터링 실패(Security Logging and Monitoring Failures)** 를 다룬다. 코드가 완벽하더라도 침해가 발생할 수 있다. 중요한 건 그것을 언제 발견하느냐다.

## 탐지 공백의 현실

![로깅·모니터링 실패: 탐지 공백](/assets/posts/websec-logging-monitoring-failures-gaps.svg)

IBM의 2023년 데이터 침해 비용 보고서에 따르면, 침해를 식별하는 데 **평균 207일**이 걸린다. 그 이유는 다음과 같다.

**로그인 실패 미기록**: 브루트포스 공격이 진행 중인데도 아무도 알지 못한다.

**중요 이벤트 알림 없음**: 관리자 계정 생성, 대량 데이터 조회, 권한 변경이 발생해도 침묵.

**로그 중앙화 부재**: 각 서버에 분산된 로그는 공격의 전체 그림을 볼 수 없게 한다.

**침해 탐지 지연**: 공격자는 207일이라는 시간 동안 내부 네트워크를 자유롭게 탐색한다.

## 무엇을 기록해야 하는가?

```python
# 반드시 기록해야 할 보안 이벤트
SECURITY_EVENTS = {
    # 인증
    'login_success': {'severity': 'info'},
    'login_failed': {'severity': 'warn'},
    'account_locked': {'severity': 'warn'},
    'password_changed': {'severity': 'info'},
    'mfa_disabled': {'severity': 'warn'},

    # 권한
    'privilege_escalation': {'severity': 'critical'},
    'admin_action': {'severity': 'info'},
    'permission_denied': {'severity': 'warn'},

    # 데이터
    'bulk_data_export': {'severity': 'warn'},
    'sensitive_data_access': {'severity': 'info'},
    'data_deletion': {'severity': 'warn'},

    # 시스템
    'config_changed': {'severity': 'warn'},
    'new_admin_created': {'severity': 'critical'},
    'api_key_generated': {'severity': 'info'},
}
```

## 구조화된 보안 로깅 구현

![보안 로깅 모범 사례](/assets/posts/websec-logging-monitoring-failures-solution.svg)

```python
import structlog
import json
from datetime import datetime

# 구조화된 로거 설정
logger = structlog.get_logger()

def log_security_event(
    event: str,
    user_id: str | None,
    ip: str,
    user_agent: str,
    details: dict | None = None,
    severity: str = 'info'
) -> None:
    log_entry = {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'event_type': event,
        'severity': severity,
        'user_id': user_id,
        'ip_address': ip,
        'user_agent': user_agent,
        'request_id': get_request_id(),
        **(details or {})
    }

    if severity == 'critical':
        logger.critical("security_event", **log_entry)
        alert_security_team(log_entry)
    elif severity == 'warn':
        logger.warning("security_event", **log_entry)
    else:
        logger.info("security_event", **log_entry)

# 사용 예시
async def login_handler(request):
    username = request.json['username']
    password = request.json['password']

    try:
        user = await authenticate(username, password)
        log_security_event(
            event='login_success',
            user_id=str(user.id),
            ip=request.remote_addr,
            user_agent=request.user_agent.string
        )
        return create_session_response(user)

    except AuthError as e:
        log_security_event(
            event='login_failed',
            user_id=None,
            ip=request.remote_addr,
            user_agent=request.user_agent.string,
            details={'reason': str(e), 'attempted_username': username},
            severity='warn'
        )
        return error_response(401, "인증 실패")
```

## 로그 무결성 보호

```python
import hashlib
import hmac

LOG_SIGNING_KEY = os.environ['LOG_SIGNING_KEY']

def sign_log_entry(log_entry: dict) -> dict:
    # 로그 엔트리에 HMAC 서명 추가
    entry_str = json.dumps(log_entry, sort_keys=True)
    signature = hmac.new(
        LOG_SIGNING_KEY.encode(),
        entry_str.encode(),
        hashlib.sha256
    ).hexdigest()

    return {**log_entry, '_signature': signature}

# 로그 파일 자체는 write-once 스토리지에 보관
# AWS S3 Object Lock, Worm 스토리지 등 활용
```

## 이상 탐지 알림

```python
from collections import defaultdict
from datetime import datetime, timedelta

# 메모리 기반 간단한 이상 탐지 (프로덕션에선 Redis 활용)
failed_logins = defaultdict(list)

def check_brute_force(ip: str) -> bool:
    now = datetime.utcnow()
    window = timedelta(minutes=5)

    # 5분 이내 실패 기록만 유지
    failed_logins[ip] = [
        t for t in failed_logins[ip]
        if now - t < window
    ]

    if len(failed_logins[ip]) >= 10:
        alert_security_team({
            'type': 'brute_force_detected',
            'ip': ip,
            'attempts': len(failed_logins[ip]),
            'window': '5min'
        })
        return True

    failed_logins[ip].append(now)
    return False
```

## SIEM 통합 (ELK Stack 예시)

```yaml
# Logstash 파이프라인 — 보안 이벤트 파싱
input {
  beats {
    port => 5044
  }
}

filter {
  if [event_type] in ["login_failed", "account_locked", "privilege_escalation"] {
    mutate {
      add_tag => ["security_alert"]
      add_field => { "[@metadata][index]" => "security-events" }
    }
  }

  # GeoIP로 IP 위치 추가
  geoip {
    source => "ip_address"
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{[@metadata][index]}-%{+YYYY.MM.dd}"
  }

  # Slack/PagerDuty 알림
  if "security_alert" in [tags] {
    http {
      url => "${SLACK_WEBHOOK_URL}"
      http_method => "post"
      format => "json"
      mapping => {
        "text" => "🚨 보안 이벤트: %{event_type} from %{ip_address}"
      }
    }
  }
}
```

## 로그에 포함하면 안 되는 것

```python
# ❌ 절대 로그에 포함 금지
def bad_logging_example(username, password, credit_card):
    logger.info(f"Login attempt: {username}:{password}")  # 비밀번호!
    logger.debug(f"Payment: card={credit_card}")           # 카드 정보!
    logger.error(f"DB Error: {db_query_with_params}")      # SQL + 파라미터!

# ✅ 올바른 로깅
def good_logging_example(username, user_id):
    logger.info("login_attempt", username=username)        # 비밀번호 없음
    logger.info("payment_processed", user_id=user_id,
                last_four="****1234")                       # 마스킹
    logger.error("db_error", error_code="ERR_CONN_TIMEOUT") # 쿼리 없음
```

## 핵심 원칙

로깅은 사후에 추가하는 것이 아니라 **설계 단계에서 포함**되어야 한다. 어떤 이벤트가 발생했을 때 조사할 수 있으려면, 그 이벤트가 기록되어 있어야 한다. "일어나지 않을 것"이라는 낙관적 가정 대신 "언제든 일어날 수 있다"는 전제로 로깅 전략을 세워야 한다.

---

**지난 글:** [취약한 인증 메커니즘 탐구하기](/posts/websec-broken-authentication/)

**다음 글:** [프로토타입 오염: JavaScript 공격 심층 분석](/posts/websec-prototype-pollution/)

<br>
읽어주셔서 감사합니다. 😊
