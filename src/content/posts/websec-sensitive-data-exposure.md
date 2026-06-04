---
title: "민감 데이터 노출: 정보 유출 방지하기"
description: "개인정보·비밀번호·API 키가 어떤 경로로 유출되는지, 암호화 미적용·취약 해시·하드코딩된 시크릿의 위험성과 방어 방법을 실제 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["민감데이터", "데이터보호", "암호화", "GDPR", "시크릿관리", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-security-misconfiguration/)에서 보안 설정 오류가 어떻게 시스템을 위험에 빠뜨리는지 살펴봤다. 이번에는 **민감 데이터 노출(Sensitive Data Exposure)** 을 다룬다. 2023년 기준 전 세계 데이터 침해의 평균 비용은 445만 달러에 달하며, 그 원인의 상당수가 예방 가능한 데이터 노출이었다.

## 민감 데이터 노출 경로

![민감 데이터 노출 경로](/assets/posts/websec-sensitive-data-exposure-vectors.svg)

민감 데이터는 네 가지 주요 경로로 유출된다.

**① 암호화 없는 전송**: HTTP로 비밀번호·카드번호를 전송하면 네트워크 상의 누구든 스니핑할 수 있다.

**② 취약한 해시 알고리즘**: MD5, SHA-1은 레인보우 테이블 공격에 취약하다. 이미 수십억 개의 MD5 해시가 크랙된 채로 공개 데이터베이스에 존재한다.

**③ 하드코딩된 시크릿**: 소스코드에 박힌 API 키, DB 비밀번호는 GitHub 등 공개 저장소에 실수로 올라가 즉시 크롤링된다.

**④ 과도한 데이터 응답**: API가 필요 이상으로 많은 필드를 반환하면 클라이언트 측에서 불필요한 민감 정보가 노출된다.

## 실제 사례: 패스워드 해시 취약성

```python
import hashlib
import bcrypt

# ❌ 취약: MD5는 GPU로 초당 수십억 번 계산 가능
def bad_hash(password: str) -> str:
    return hashlib.md5(password.encode()).hexdigest()

# ❌ 취약: SHA256도 빠르기 때문에 비밀번호 해싱에는 부적합
def also_bad(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# ✅ 올바른 방법: bcrypt (의도적으로 느림, 솔트 내장)
def good_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)  # 비용 인수 12 = ~300ms
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())
```

## 하드코딩된 시크릿 위험

```bash
# 공격자가 GitHub에서 노출된 시크릿을 찾는 방법
# (실제 공격 도구들이 24시간 GitHub을 스캔한다)
grep -r "aws_access_key_id" .
grep -r "sk-[a-zA-Z0-9]{32}" .  # OpenAI API 키 패턴
grep -r "postgres://.*:.*@" .
```

```python
# ❌ 절대 금지: 하드코딩
DATABASE_URL = "postgres://admin:SuperSecret123@db.internal:5432/prod"
AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
STRIPE_SECRET = "[하드코딩 절대 금지 — 환경변수 사용]"

# ✅ 환경변수 사용
import os
DATABASE_URL = os.environ["DATABASE_URL"]
AWS_SECRET_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
```

## 과도한 데이터 응답

```javascript
// ❌ 위험: 사용자 객체 전체를 반환
app.get('/api/users/me', async (req, res) => {
  const user = await User.findById(req.user.id)
  res.json(user)  // passwordHash, internalId, isAdmin 등 모두 포함!
})

// ✅ 안전: 필요한 필드만 선택해서 반환
app.get('/api/users/me', async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('name email avatarUrl createdAt')  // 민감 필드 제외
  res.json(user)
})
```

## 민감 데이터 보호 방법

![민감 데이터 보호 방법](/assets/posts/websec-sensitive-data-exposure-protection.svg)

### TLS 설정 강화

```nginx
# HTTPS 강제 및 TLS 버전 제한
server {
    listen 443 ssl http2;

    ssl_protocols TLSv1.2 TLSv1.3;  # TLS 1.0, 1.1 비활성화
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS: 1년간 HTTPS만 허용
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### 시크릿 관리 도구 사용

```bash
# HashiCorp Vault 사용 예시
# 시크릿 저장
vault kv put secret/myapp/db \
  username=myuser \
  password=mypassword

# 애플리케이션에서 동적으로 가져오기
vault kv get -field=password secret/myapp/db
```

```python
# AWS Secrets Manager 사용
import boto3
import json

def get_secret(secret_name: str) -> dict:
    client = boto3.client('secretsmanager', region_name='ap-northeast-2')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# 애플리케이션 시작 시 한 번만 로드
db_config = get_secret('prod/myapp/database')
```

### Git 히스토리에서 시크릿 제거

```bash
# 시크릿이 커밋된 경우 — git-filter-repo로 히스토리 정리
pip install git-filter-repo

git filter-repo --replace-text <(echo 'ACTUAL_SECRET==>REDACTED')

# 이후 강제 푸시 (모든 팀원 재클론 필요)
git push origin --force --all
```

### 데이터 분류 및 최소화

민감 데이터를 다루기 전에 먼저 분류한다.

| 분류 | 예시 | 조치 |
|---|---|---|
| 최고 민감 | 비밀번호, 결제 정보, SSN | 해시/암호화 필수, 로그 금지 |
| 민감 | 이메일, 전화번호, IP | 암호화 권장, 접근 제한 |
| 내부 | 사용자 ID, 타임스탬프 | 접근 로깅 |
| 공개 | 공개 프로필, 게시물 | 제한 없음 |

## 핵심 원칙

**"필요하지 않은 데이터는 수집하지 말고, 수집했다면 반드시 보호하라."**

GDPR, CCPA 등 개인정보 보호법은 이제 법적 의무다. 기술적 보호 조치와 함께 데이터 보존 정책, 접근 제어, 정기적인 감사도 필수다.

---

**지난 글:** [보안 설정 오류: 잘못된 기본 설정의 위험](/posts/websec-security-misconfiguration/)

**다음 글:** [XXE 인젝션: XML 외부 엔티티 공격 완전 해설](/posts/websec-xxe/)

<br>
읽어주셔서 감사합니다. 😊
