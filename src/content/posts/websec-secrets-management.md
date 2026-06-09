---
title: "시크릿 관리: Vault·AWS Secrets Manager로 자격증명 안전하게 보관하기"
description: "하드코딩·평문 .env의 위험, HashiCorp Vault 동적 자격증명, AWS Secrets Manager, Kubernetes Sealed Secrets, CI/CD 파이프라인 시크릿 보호, 자동 로테이션 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["시크릿관리", "Vault", "SecretsManager", "자격증명", "API키", "로테이션", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-post-quantum-intro/)에서 암호 알고리즘 전환을 살펴봤다. 아무리 강력한 암호 알고리즘을 써도, API 키·DB 비밀번호·TLS 인증서 개인키가 소스코드에 박혀 있거나 .env 파일로 평문 노출되면 모든 암호학적 보호가 무의미해진다. 시크릿 관리는 암호화와 함께 보안 기초 중에서도 가장 자주 놓치는 영역이다.

## 가장 흔한 시크릿 유출 경로

깃허브에서 `"api_key"` 키워드로 검색하면 수십만 건의 실제 API 키를 찾을 수 있다. 개발자가 "잠깐"만 쓰려고 커밋했다 잊는 경우, `.gitignore`에 `.env`를 추가했지만 이미 추적된 파일을 제거하지 않은 경우, CI 로그에 환경변수 덤프가 출력된 경우가 대표적이다.

![시크릿 관리 아키텍처: 잘못된 방식 vs 올바른 방식](/assets/posts/websec-secrets-mgmt-flow.svg)

```bash
# 이미 커밋된 시크릿 제거 (git filter-repo)
pip install git-filter-repo
git filter-repo --path .env --invert-paths
# 모든 브랜치에서 .env 파일 히스토리 삭제
# 단: 이미 fork되거나 GitHub 캐시에 남아 있을 수 있음 → 시크릿 즉시 무효화 필수
```

커밋 히스토리에서 파일을 제거해도 이미 노출된 시크릿은 **즉시 무효화**해야 한다. 제거만으로는 부족하다.

## HashiCorp Vault — 동적 자격증명

Vault의 핵심 가치는 **동적 자격증명**이다. 앱이 DB에 접속할 때마다 Vault가 임시 계정을 생성하고, TTL이 지나면 자동 삭제한다. DB 비밀번호를 어딘가에 저장할 필요가 없다.

![시크릿 관리 도구 비교](/assets/posts/websec-secrets-tools-comparison.svg)

```bash
# Vault AppRole 인증 (컨테이너 앱용)
# 1. AppRole 활성화
vault auth enable approle
vault write auth/approle/role/my-app \
  token_policies="my-app-policy" \
  token_ttl=1h \
  token_max_ttl=4h

# 2. Role ID / Secret ID 발급
vault read auth/approle/role/my-app/role-id
vault write -f auth/approle/role/my-app/secret-id

# 3. 앱이 토큰 획득 후 시크릿 읽기
vault write auth/approle/login \
  role_id=$ROLE_ID secret_id=$SECRET_ID
vault kv get secret/my-app/db-creds
```

Vault Agent를 사이드카로 배포하면 앱 코드가 Vault API를 직접 호출할 필요 없이 환경변수나 파일로 시크릿을 주입받을 수 있다.

## AWS Secrets Manager 실전 패턴

AWS 환경이라면 Secrets Manager + IAM 역할 조합이 가장 매끄럽다. EC2/ECS/Lambda에 IAM 역할만 부여하면 별도 인증 없이 시크릿에 접근할 수 있다.

```python
import boto3
import json
from functools import lru_cache

# 캐싱: 매 요청마다 API 호출하지 않도록
@lru_cache(maxsize=None)
def get_secret(secret_name: str) -> dict:
    client = boto3.client("secretsmanager", region_name="ap-northeast-2")
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

# 사용
db_creds = get_secret("prod/myapp/db")
conn = psycopg2.connect(
    host=db_creds["host"],
    user=db_creds["username"],
    password=db_creds["password"],
    database=db_creds["dbname"]
)
```

자동 교체는 Lambda 함수를 연결해 설정한다. RDS, Redshift, DocumentDB는 기본 교체 Lambda 템플릿을 제공한다.

## Kubernetes 시크릿 보안

Kubernetes Secret은 기본적으로 base64 인코딩일 뿐, 암호화가 아니다. etcd에 평문(base64)으로 저장된다.

```yaml
# etcd Encryption at Rest 설정 (kube-apiserver)
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}
```

더 강력한 방법은 **External Secrets Operator**를 사용해 Vault나 AWS Secrets Manager의 시크릿을 K8s Secret으로 동기화하는 것이다. 시크릿 원본은 외부 관리 시스템에만 있고, K8s는 실시간으로 참조한다.

## CI/CD 파이프라인 시크릿 보호

```yaml
# GitHub Actions: OIDC로 AWS 자격증명 없이 인증
jobs:
  deploy:
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-role
          aws-region: ap-northeast-2
      # AWS_ACCESS_KEY_ID/SECRET 없이 임시 자격증명 자동 획득
      - run: aws s3 cp ./dist s3://my-bucket/
```

OIDC 토큰 기반 인증은 장기 자격증명을 저장할 필요가 없어 유출 위험이 구조적으로 제거된다.

## 시크릿 탐지 자동화

```bash
# pre-commit hook: 커밋 전 시크릿 스캔
pip install detect-secrets
detect-secrets scan > .secrets.baseline
# .pre-commit-config.yaml에 추가
# - repo: https://github.com/Yelp/detect-secrets
#   hooks:
#     - id: detect-secrets
#       args: ['--baseline', '.secrets.baseline']

# truffleHog: 전체 git 히스토리 스캔
trufflehog git file://. --since-commit HEAD~50
```

시크릿 관리는 "도입하면 끝"이 아니다. 정기적인 로테이션, 침해 시 즉각 무효화, CI/CD 파이프라인 스캔 자동화, 감사 로그 모니터링이 함께 운영되어야 실질적인 보호가 가능하다.

---

**지난 글:** [포스트 퀀텀 암호학 입문: 양자 컴퓨터 시대의 암호 전환 전략](/posts/websec-post-quantum-intro/)

**다음 글:** [API 보안 개요: REST·GraphQL·gRPC API를 안전하게 설계하는 원칙](/posts/websec-api-security-overview/)

<br>
읽어주셔서 감사합니다. 😊
