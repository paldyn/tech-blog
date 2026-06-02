---
title: "인젝션 취약점 완전 정복: 개요와 공통 원리"
description: "인젝션 취약점의 공통 원리와 SQL·NoSQL·Command·Template·XSS 등 주요 유형을 분류하고, 입력 검증·파라미터 바인딩·출력 인코딩의 세 축 방어 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["인젝션", "SQL인젝션", "XSS", "Command인젝션", "입력검증", "OWASP"]
featured: false
draft: false
---

[지난 글](/posts/websec-owasp-top10-overview/)에서 OWASP Top 10 전체를 개관했다. 이제부터 각 취약점 계열을 심화 탐구한다. 가장 먼저 다룰 것은 **인젝션(Injection)**이다. OWASP Top 10 A03이자 웹 취약점의 가장 근본적인 카테고리로, 이후 이어질 XSS·CSRF·SSRF 편에서도 공통적으로 적용되는 원리를 담고 있다.

## 인젝션이란

인젝션은 **신뢰할 수 없는 데이터(사용자 입력, 외부 파라미터)가 명령어 해석기(인터프리터)로 전달될 때** 발생한다. 인터프리터는 이 데이터를 데이터가 아닌 **명령어**로 해석하고 실행한다.

핵심 전제: 데이터와 코드가 구분되지 않는다.

```
정상: "SELECT * FROM users WHERE id = 1"
                                        ↑ 데이터 (숫자)

공격: "SELECT * FROM users WHERE id = 1 OR 1=1"
                                        ↑↑↑↑↑↑↑↑ 데이터에 명령어가 섞임
```

## 인젝션 유형 분류

![인젝션 취약점 유형](/assets/posts/websec-injection-overview-types.svg)

인젝션은 대상 인터프리터에 따라 분류된다.

**데이터베이스 인젝션**: SQL(가장 흔함), NoSQL(MongoDB $where, $ne 연산자 남용), LDAP, ORM 우회

**서버 사이드 인젝션**: OS 명령어(Command Injection), 템플릿 엔진(SSTI — Jinja2, Twig, FreeMarker), XML 파서(XXE)

**클라이언트 사이드 인젝션**: XSS(Reflected, Stored, DOM 기반), CSS Injection, HTML Injection

## 공통 공격 패턴

모든 인젝션은 세 단계를 거친다.

1. **탈출(Escape)**: 데이터 컨텍스트를 닫는 문자를 삽입한다 (`'`, `"`, `>`, `\n`, `{{ ` 등)
2. **명령 삽입**: 원하는 명령어를 삽입한다 (`OR 1=1`, `; id`, `{{7*7}}`)
3. **주석/무효화**: 나머지 원본 쿼리를 무력화한다 (`--`, `#`, `*/`)

```sql
-- 원본 쿼리 의도
SELECT * FROM users WHERE name = '{입력값}' AND active = 1

-- 입력: ' OR '1'='1' --
-- 실제 실행
SELECT * FROM users WHERE name = '' OR '1'='1' -- ' AND active = 1
-- 결과: 모든 사용자 반환 (인증 우회)
```

## 왜 여전히 흔한가

인젝션이 수십 년째 최상위 취약점으로 남아있는 이유는 세 가지다.

**편의성의 유혹**: 문자열 결합으로 쿼리를 만드는 것이 파라미터 바인딩보다 짧고 직관적으로 보인다.

**레거시 코드**: 오래된 코드베이스에서 안전하지 않은 패턴이 반복 복사된다.

**컨텍스트 다양성**: HTML, SQL, Shell, JavaScript, Regex 등 각기 다른 인코딩 규칙이 있어 전부 이해하기 어렵다.

## 세 축 방어 전략

![인젝션 방어 코드](/assets/posts/websec-injection-overview-defense.svg)

### 1. 입력 검증 — 허용 목록(Allowlist)

차단 목록(Blocklist) 방식은 공격자가 우회 문자를 찾으면 무너진다. 허용 목록 방식으로 기대하는 형식만 통과시켜야 한다.

```python
import re
from typing import Optional

def validate_integer(value: str, min_val: int = 0, max_val: int = 10**9) -> int:
    """정수형 입력 검증"""
    try:
        n = int(value)
    except (ValueError, TypeError):
        raise ValueError("정수가 아닙니다")
    if not (min_val <= n <= max_val):
        raise ValueError(f"범위 초과: {min_val}~{max_val}")
    return n

def validate_email(value: str) -> str:
    """이메일 형식 검증 (단순 패턴)"""
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    if not re.fullmatch(pattern, value.strip()):
        raise ValueError("유효하지 않은 이메일")
    return value.strip().lower()
```

### 2. 파라미터 바인딩 — 데이터와 코드 분리

SQL 파라미터 바인딩, ORM 사용, PreparedStatement가 가장 확실한 SQL 인젝션 방어다.

```python
# 위험: 문자열 포맷팅
def get_user_UNSAFE(username: str):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    return db.execute(query)

# 안전: 파라미터 바인딩
def get_user_safe(username: str):
    query = "SELECT * FROM users WHERE username = %s"
    return db.execute(query, (username,))

# ORM 사용 (Django 예시)
from django.db import models
user = User.objects.filter(username=username).first()  # 자동으로 안전
```

### 3. 출력 인코딩 — 컨텍스트별 이스케이프

출력 위치(HTML, URL, JS, CSS)에 맞는 인코딩을 적용해 삽입된 페이로드가 코드로 해석되지 않게 한다.

```python
from markupsafe import escape  # HTML 컨텍스트
import urllib.parse             # URL 컨텍스트
import json                     # JSON/JS 컨텍스트

# HTML 출력 — <script>alert(1)</script> → &lt;script&gt;...
safe_html = escape(user_comment)

# URL 파라미터 — q=<script> → q=%3Cscript%3E
safe_url_param = urllib.parse.quote(search_term)

# JSON 내 문자열 — 기본 json.dumps가 처리
safe_json = json.dumps({"name": user_name})
```

## 최소 권한 원칙 적용

방어가 뚫렸을 때 피해를 최소화하기 위해 DB 계정에 최소 권한을 부여한다.

```sql
-- 앱 전용 계정에 필요한 권한만 부여
CREATE USER 'webapp'@'localhost' IDENTIFIED BY 'strong_pass';
GRANT SELECT, INSERT, UPDATE ON appdb.users TO 'webapp'@'localhost';
-- DROP, ALTER, FILE, SUPER 등 위험 권한 절대 부여 금지
```

## WAF는 보조 수단

Web Application Firewall(WAF)은 알려진 인젝션 패턴을 차단하지만 우회 기법이 존재한다. WAF는 **심층 방어의 한 레이어**일 뿐이며, 근본적인 코드 수준 방어를 대체할 수 없다.

인젝션 취약점의 핵심은 단순하다. **데이터와 코드를 항상 분리**하라. 다음 글부터는 인젝션 계열 중 가장 피해가 큰 SQL 인젝션을 깊이 파헤친다.

---

**지난 글:** [OWASP Top 10: 가장 위험한 웹 취약점 개관](/posts/websec-owasp-top10-overview/)

**다음 글:** [SQL 인젝션: 공격 원리와 방어 완전 정복](/posts/websec-sql-injection/)

<br>
읽어주셔서 감사합니다. 😊
