---
title: "최소 권한 원칙(Least Privilege): 접근 권한 최소화"
description: "최소 권한 원칙의 개념과 웹 보안에서의 적용 방법을 설명합니다. 데이터베이스, API, 클라우드 IAM, 컨테이너까지 실전 코드와 함께 권한 최소화 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["최소권한", "Least Privilege", "RBAC", "IAM", "접근제어"]
featured: false
draft: false
---

[지난 글](/posts/websec-defense-in-depth/)에서 여러 보안 계층을 쌓는 심층 방어를 배웠다. 그 모든 계층을 관통하는 단 하나의 원칙이 있다면 **최소 권한(Least Privilege)**이다. 1974년 Jerome Saltzer와 Michael Schroeder가 제안한 이 원칙은 단순하다. "모든 프로그램과 사용자는 업무 수행에 필요한 최소한의 권한만 가져야 한다." 반세기가 지난 지금도 수많은 침해 사고는 이 원칙의 위반에서 시작된다.

## 최소 권한이 왜 중요한가?

계정이 침해되거나 취약점이 악용되면, 공격자는 그 계정의 권한을 그대로 갖는다. 루트 권한으로 실행되는 서버가 해킹되면 서버 전체가 장악된다. 반면 최소 권한 계정이 침해되면 피해 범위가 그 계정이 접근할 수 있는 리소스로 제한된다.

```text
침해 시나리오 비교

과도한 권한 (Admin DB 사용자 침해)
  공격자 획득 권한: 모든 DB 읽기/쓰기/삭제, 사용자 생성, 스키마 변경
  피해: 전체 DB 삭제, 랜섬웨어, 전체 데이터 유출

최소 권한 (READ-ONLY DB 사용자 침해)
  공격자 획득 권한: 특정 테이블 SELECT만
  피해: 제한적 데이터 조회 (쓰기·삭제 불가)
```

![최소 권한 원칙 개념](/assets/posts/websec-least-privilege-concept.svg)

## 데이터베이스 최소 권한

```sql
-- 잘못된 예: 모든 권한 부여
GRANT ALL PRIVILEGES ON *.* TO 'app'@'%' WITH GRANT OPTION;

-- 올바른 예: 애플리케이션 필요 권한만
-- 1. 일반 API 서버용
CREATE USER 'api_user'@'10.0.1.%' IDENTIFIED BY '...';
GRANT SELECT, INSERT, UPDATE ON myapp.users TO 'api_user'@'10.0.1.%';
GRANT SELECT, INSERT ON myapp.orders TO 'api_user'@'10.0.1.%';
-- DELETE는 소프트 삭제로 대체 (is_deleted 플래그)

-- 2. 배치 작업용 (읽기 전용)
CREATE USER 'batch_user'@'10.0.2.1' IDENTIFIED BY '...';
GRANT SELECT ON myapp.* TO 'batch_user'@'10.0.2.1';

-- 3. 마이그레이션용 (별도 관리, CI/CD에서만 사용)
CREATE USER 'migrate_user'@'10.0.3.1' IDENTIFIED BY '...';
GRANT ALTER, CREATE, DROP, INDEX ON myapp.* TO 'migrate_user'@'10.0.3.1';
```

## API 토큰 최소 권한

```python
# OAuth2 스코프를 이용한 최소 권한
import requests

# ❌ 넓은 스코프
token_request = {
    "scope": "admin:*"  # 모든 관리 권한
}

# ✅ 필요한 스코프만
token_request = {
    "scope": "read:users write:comments",  # 필요한 것만
    "expires_in": 3600  # 1시간 후 만료
}

# 내부 서비스 간 통신에서도 스코프 제한
SERVICE_SCOPES = {
    "notification-service": ["read:users", "send:email"],
    "analytics-service":    ["read:events"],
    "payment-service":      ["read:users", "write:payments"]
}
```

## RBAC (역할 기반 접근 제어)

![RBAC 구조](/assets/posts/websec-least-privilege-rbac.svg)

RBAC는 최소 권한을 확장성 있게 구현하는 방법이다. 권한을 역할에 부여하고, 사용자는 역할을 통해 간접적으로 권한을 얻는다.

```python
# Django + guardian을 이용한 RBAC 예시
from django.contrib.auth.decorators import permission_required
from guardian.decorators import permission_required_or_403

# 역할별 권한 정의
ROLE_PERMISSIONS = {
    "developer": [
        "view_staging_logs",
        "deploy_staging",
        "run_tests",
    ],
    "operator": [
        "view_production_logs",
        "restart_services",
        "manage_config",
    ],
    "analyst": [
        "view_dashboard",
        "export_reports",
        # 개인식별정보(PII) 접근 없음
    ],
}

@permission_required('view_production_logs', raise_exception=True)
def production_logs_view(request):
    ...
```

## 클라우드 IAM 최소 권한

AWS IAM 정책에서 최소 권한을 적용하는 실전 예시다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::my-app-uploads/*",
      "Condition": {
        "StringEquals": {
          "s3:prefix": ["uploads/images/"]
        }
      }
    }
  ]
}
```

```text
IAM 최소 권한 체크리스트
☑ AdministratorAccess 역할 사용 금지 (운영 계정)
☑ 리소스 ARN을 * 대신 구체적으로 명시
☑ 조건(Condition) 블록으로 추가 제한
☑ 서비스 계정에 MFA 조건 추가
☑ 90일마다 미사용 권한 감사 및 제거
☑ AWS IAM Access Analyzer 활성화
```

## 컨테이너와 프로세스

```dockerfile
# ❌ root로 실행
FROM ubuntu:22.04
CMD ["node", "server.js"]

# ✅ 전용 비루트 사용자
FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001
USER nodeuser
# 읽기 전용 파일 시스템
# --read-only 플래그 또는 securityContext.readOnlyRootFilesystem: true
CMD ["node", "server.js"]
```

## Just-In-Time (JIT) 접근

최소 권한의 발전된 형태는 "필요할 때만, 임시로" 권한을 부여하는 JIT 접근이다.

```text
JIT 접근 워크플로
1. 운영자가 프로덕션 DB 접근 요청
2. 승인자(다른 팀원) 검토 및 승인
3. 시스템이 1시간 임시 자격증명 발급
4. 접근 완료 후 자동 만료
5. 모든 행위 감사 로그 기록

도구: HashiCorp Vault, AWS IAM Identity Center,
      CyberArk, BeyondTrust
```

최소 권한은 보안의 가장 기본 원칙이지만, 실제로 잘 지켜지는 경우는 드물다. "일단 다 주고 나중에 줄이자"는 접근은 결국 나중에 줄이는 일이 일어나지 않는다. 처음부터 꼭 필요한 것만 부여하는 습관이 중요하다.

---

**지난 글:** [심층 방어(Defense in Depth): 다층 보안 전략](/posts/websec-defense-in-depth/)

**다음 글:** [제로 트러스트(Zero Trust): 아무도 믿지 않는 보안 모델](/posts/websec-zero-trust/)

<br>
읽어주셔서 감사합니다. 😊
