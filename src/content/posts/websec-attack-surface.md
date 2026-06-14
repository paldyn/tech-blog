---
title: "공격 표면 이해하기"
description: "웹 애플리케이션의 공격 표면(Attack Surface)이 무엇인지, HTTP 엔드포인트·사용자 입력·의존성·관리자 인터페이스 등 진입점별 위험 요소와 표면 축소 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["공격표면", "AttackSurface", "보안설계", "의존성보안", "최소권한"]
featured: false
draft: false
---

[지난 글](/posts/websec-threat-modeling/)에서 위협 모델링의 첫 단계로 "시스템 분해"를 다뤘다. 이 단계의 핵심 결과물이 바로 **공격 표면(Attack Surface)** 지도다. 공격 표면은 공격자가 시스템에 접근하거나 데이터를 조작할 수 있는 모든 진입점의 합이다. 표면이 클수록 관리해야 할 위험이 많아진다.

## 공격 표면이란

공격 표면은 "공격자가 도달할 수 있는 코드·데이터·인터페이스의 총합"이다. 코드 한 줄, 열린 포트 하나, 오래된 라이브러리 하나가 모두 표면의 일부다.

공격 표면을 세 가지 축으로 분류할 수 있다.

**네트워크 공격 표면**: 인터넷에 노출된 포트, 프로토콜, 서비스. HTTP/HTTPS 외에 불필요하게 열린 SSH, Redis, 관리자 포트가 해당한다.

**소프트웨어 공격 표면**: 코드로 구현된 모든 입력 처리 경로. API 엔드포인트, 폼, URL 파라미터, 파일 업로드, 웹훅.

**인간 공격 표면**: 사회공학 공격의 대상이 되는 사람과 프로세스. 개발자 자격증명, 관리자 계정, 온보딩 절차.

![웹 애플리케이션 공격 표면 전체 지도](/assets/posts/websec-attack-surface-map.svg)

## 주요 공격 표면 영역

### HTTP 엔드포인트 · API

웹 애플리케이션의 가장 큰 공격 표면이다. 모든 URL은 잠재적 공격 벡터다. 특히 위험한 것들은 다음과 같다.

- **인증 없는 관리자 엔드포인트**: 개발 편의를 위해 남겨둔 `/admin`, `/debug`, `/health?verbose=true`
- **GraphQL 인트로스펙션**: 프로덕션에서 활성화되면 전체 스키마가 노출된다
- **이전 버전 API**: `/api/v1`이 `/api/v2`로 업그레이드됐어도 구버전이 여전히 응답하는 경우

```bash
# 노출된 엔드포인트 탐색 (정당한 자기 테스트)
curl -s https://myapp.com/api/ | python3 -m json.tool
# robots.txt에서 숨겨진 경로 확인
curl https://myapp.com/robots.txt
# 웹팩 번들에서 API 경로 추출
grep -r "api/" dist/main.js | head -20
```

### 사용자 입력

사용자가 제어하는 모든 데이터는 신뢰할 수 없다. 폼 필드, URL 파라미터, HTTP 헤더, 쿠키, 요청 본문 전체가 해당한다.

```python
# 취약: 사용자 입력을 검증 없이 사용
@app.route("/user")
def get_user():
    user_id = request.args.get("id")  # 공격자가 제어 가능
    return db.execute(f"SELECT * FROM users WHERE id = {user_id}")

# 안전: 타입 강제 + 파라미터화 쿼리
@app.route("/user")
def get_user_safe():
    try:
        user_id = int(request.args.get("id", ""))
    except ValueError:
        return {"error": "invalid id"}, 400
    return db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
```

### 의존성 · 라이브러리

현대 웹 애플리케이션은 수백 개의 외부 패키지에 의존한다. 하나의 취약한 패키지가 전체 시스템을 위험에 빠뜨린다. 2021년 Log4Shell 취약점은 수백만 개 애플리케이션에 영향을 미쳤다.

```bash
# 의존성 취약점 감사
npm audit --audit-level=high      # Node.js
pip-audit                         # Python
mvn dependency-check:check        # Java Maven
bundle exec bundle audit          # Ruby Bundler

# 오래된 패키지 확인
npm outdated
pip list --outdated
```

### 관리자 인터페이스

관리자 패널은 가장 민감한 기능을 담고 있으면서 공격 빈도도 높다. 기본 관리자 경로(`/admin`, `/wp-admin`, `/_cpanel`)는 자동화 스캐너가 가장 먼저 시도한다.

### 파일 업로드

파일 업로드는 공격자가 악성 코드를 서버에 올릴 수 있는 경로다. 확장자 검사만으로는 충분하지 않다. MIME 타입 검증, 파일 내용 스캔, 격리 저장이 필요하다.

## 공격 표면 축소 전략

![Before vs After 공격 표면 축소](/assets/posts/websec-attack-surface-reduction.svg)

**원칙 1: 불필요한 기능 제거**: 사용하지 않는 API 엔드포인트, 개발용 디버그 라우트, 비활성 서비스를 제거한다. 없애는 것이 막는 것보다 낫다.

**원칙 2: 기본값 닫기(Default Deny)**: 명시적으로 허용하지 않은 모든 것을 차단한다. 방화벽, API 게이트웨이, 인가 레이어 모두 화이트리스트 방식으로 설계한다.

**원칙 3: 최소 권한**: 각 컴포넌트에 필요한 최소한의 권한만. DB 연결은 읽기/쓰기 분리, 마이크로서비스는 자신의 데이터만 접근.

**원칙 4: 공격 표면 정기 측정**: 스프린트마다 새 엔드포인트가 추가된다. 정기적으로 라우트 목록을 리뷰하고, 자동화 스캔 도구(OWASP ZAP, Burp Suite)로 노출 여부를 확인한다.

```python
# Flask 라우트 목록 자동 출력 (정기 감사용)
from flask import Flask
app = Flask(__name__)

def audit_routes():
    for rule in app.url_map.iter_rules():
        print(f"{rule.methods} {rule.rule} -> {rule.endpoint}")

# Django의 경우
# python manage.py show_urls (django-extensions)
```

공격 표면 축소는 일회성 작업이 아니다. 기능을 추가할 때마다 표면이 늘어나므로, CI/CD 파이프라인에 표면 측정을 통합하는 것이 이상적이다. 새 의존성 추가 시 자동 감사, 새 엔드포인트 추가 시 보안 리뷰를 의무화하는 것이 성숙한 보안 문화의 표시다.

---

**지난 글:** [위협 모델링 입문](/posts/websec-threat-modeling/)

**다음 글:** [보안 사고방식 기르기](/posts/websec-security-mindset/)

<br>
읽어주셔서 감사합니다. 😊
