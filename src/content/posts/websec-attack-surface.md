---
title: "공격 표면(Attack Surface) 분석과 축소 전략"
description: "공격 표면의 개념과 웹 애플리케이션에서 발생하는 다양한 진입점을 분석합니다. 코드, API, 의존성, 인프라 관점에서 공격 표면을 줄이는 실전 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["공격표면", "Attack Surface", "보안강화", "최소화", "의존성관리"]
featured: false
draft: false
---

[지난 글](/posts/websec-threat-modeling/)에서 STRIDE와 DREAD로 위협을 체계적으로 분석하는 방법을 배웠다. 위협 모델링이 "어떤 공격이 가능한가?"를 묻는다면, **공격 표면(Attack Surface) 분석**은 "공격자가 접근할 수 있는 모든 진입점이 무엇인가?"를 묻는다. 공격 표면이 넓을수록 취약점이 존재할 가능성도 높아진다. 방어의 첫 번째 원칙은 "막지 못한다면, 줄여라"다.

## 공격 표면이란?

공격 표면은 시스템에서 **공격자가 데이터를 입력하거나, 데이터를 추출하거나, 명령을 실행할 수 있는 모든 경로의 합**이다. 세 가지 차원으로 나뉜다.

```text
공격 표면 분류
├── 디지털 공격 표면 (Digital Attack Surface)
│   ├── 코드 — 취약한 함수, 안전하지 않은 라이브러리
│   ├── API — 공개 엔드포인트, 미인증 라우트
│   └── 포트 — 열려있는 네트워크 포트
├── 물리적 공격 표면 (Physical Attack Surface)
│   └── 데이터센터 접근, USB 포트, 악성 내부자
└── 사회공학적 공격 표면 (Social Engineering)
    └── 이메일 피싱, 직원 대상 사기
```

웹 보안 관점에서는 주로 디지털 공격 표면을 다룬다.

## 웹 애플리케이션의 주요 공격 진입점

![공격 표면 맵](/assets/posts/websec-attack-surface-map.svg)

### 1. 사용자 입력 (User Input)

모든 사용자 입력은 잠재적 공격 벡터다.

```http
# 공격자가 조작할 수 있는 입력 채널
GET /search?q=<script>alert(1)</script>    # URL 파라미터
POST /login                                 # 요청 바디
Cookie: session=stolen_token               # 쿠키
Referer: http://attacker.com               # HTTP 헤더
X-Forwarded-For: 127.0.0.1                # 커스텀 헤더
Content-Type: application/x-www-form-urlencoded  # 콘텐츠 타입
```

### 2. API 엔드포인트

노출된 API 엔드포인트는 공격자의 주요 탐색 대상이다. 특히 문서화되지 않았거나 비활성화되어야 할 엔드포인트는 위험하다.

```bash
# 공격자가 스캔하는 일반적인 경로
/api/v1/admin
/api/v2/internal
/actuator/env          # Spring Boot 관리 엔드포인트
/debug                 # 디버그 모드
/.well-known/          # 숨겨진 설정 파일
/phpinfo.php           # PHP 환경 정보 노출
/web.config            # IIS 설정 파일
/.git/config           # Git 설정 파일 (소스 코드 유출!)
```

### 3. 서드파티 의존성

현대 웹 앱은 수백~수천 개의 오픈소스 패키지에 의존한다. 각 패키지가 잠재적 취약점 소스다.

```bash
# Node.js 프로젝트의 의존성 감사
npm audit
# 출력 예시: 3 high, 12 moderate severity vulnerabilities

# 의존성 트리 확인
npm list --depth=0

# Snyk으로 지속적 모니터링
snyk test
snyk monitor
```

2021년 Log4Shell 취약점처럼 널리 쓰이는 라이브러리 하나가 수만 개 앱에 영향을 미친다.

### 4. 클라우드·인프라 설정

```text
클라우드 공격 표면
├── 잘못 설정된 S3/GCS 버킷 (공개 읽기 허용)
├── 과도한 IAM 권한 (AdministratorAccess 남용)
├── 노출된 메타데이터 API (169.254.169.254)
├── 기본 자격증명 사용 (admin/admin)
└── 불필요한 포트 공개 (개발 DB 인터넷 노출)
```

![공격 표면 축소 전후](/assets/posts/websec-attack-surface-reduction.svg)

## 공격 표면 축소 전략

### 코드 레벨 축소

```python
# ❌ 과도한 기능 노출
@app.route('/api/users', methods=['GET', 'POST', 'PUT', 'DELETE'])
def users():
    ...

# ✅ 필요한 HTTP 메서드만 허용
@app.route('/api/users', methods=['GET'])
def list_users():
    ...

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@require_auth
def update_user(user_id):
    ...
```

### 의존성 최소화

```text
의존성 관리 원칙
1. 필요한 패키지만 설치 (의존성 리뷰 필수)
2. 정기적인 감사 (npm audit, pip-audit, Snyk)
3. SBOM (Software Bill of Materials) 유지
4. 오래된 버전 즉시 업데이트
5. 신뢰할 수 없는 패키지 차단 (private registry 사용)
```

### 엔드포인트 보호

```nginx
# Nginx: 어드민 엔드포인트 내부망 제한
location /admin {
    allow 10.0.0.0/8;      # 내부망만 허용
    allow 192.168.0.0/16;
    deny all;
}

# 불필요한 HTTP 메서드 차단
if ($request_method !~ ^(GET|POST|PUT|DELETE)$) {
    return 405;
}
```

### 정보 최소화 원칙

```python
# ❌ 상세 오류 메시지 (공격자에게 정보 제공)
# OperationalError: (1045, "Access denied for user 'root'@'localhost'")

# ✅ 일반화된 오류 응답
@app.errorhandler(500)
def internal_error(e):
    app.logger.error(f"Internal error: {e}")  # 서버에만 로그
    return {"error": "서비스 오류가 발생했습니다."}, 500
```

## 공격 표면 모니터링

공격 표면은 코드 배포, 인프라 변경, 의존성 업데이트마다 달라진다. 자동화된 모니터링이 필요하다.

```bash
# 1. 외부 공격자 시각에서 포트 스캔
nmap -sV --open -p 1-65535 example.com

# 2. 웹 디렉토리 탐색
ffuf -w /wordlists/common.txt -u https://example.com/FUZZ

# 3. 의존성 취약점 자동 탐지 (CI/CD 파이프라인)
# GitHub Actions 예시
# uses: aquasecurity/trivy-action@master

# 4. 클라우드 설정 감사
# AWS Security Hub, Google Security Command Center
```

공격 표면 분석은 한 번 수행하고 끝나는 것이 아니다. 지속적인 자산 발견과 취약점 추적이 필요하다. 다음 글에서는 심층 방어(Defense in Depth) 전략을 통해 공격 표면에 여러 겹의 방어막을 쌓는 방법을 다룬다.

---

**지난 글:** [위협 모델링: 체계적으로 공격을 예측하는 방법](/posts/websec-threat-modeling/)

**다음 글:** [심층 방어(Defense in Depth): 다층 보안 전략](/posts/websec-defense-in-depth/)

<br>
읽어주셔서 감사합니다. 😊
