---
title: "클라우드 IAM 잘못된 설정: 과도한 권한과 방어 전략"
description: "AWS IAM 와일드카드 남용, 루트 계정 미보호, 키 노출, 역할 탈취 공격 경로와 최소 권한 정책, SCP, IAM Access Analyzer, CloudTrail 감사 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["CloudIAM", "AWS", "최소권한", "CSPM", "CloudTrail", "SCP", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-container-security/)에서 컨테이너 환경의 보안 위협과 하드닝을 살펴봤다. 이번 글은 클라우드 인프라 침해의 가장 흔한 원인인 IAM(Identity and Access Management) 잘못된 설정을 집중적으로 다룬다.

![클라우드 IAM 잘못된 설정 위협 맵](/assets/posts/websec-cloud-iam-misconfig-risks.svg)

## IAM 잘못된 설정이 위험한 이유

전통적인 네트워크 경계 보안이 클라우드에서는 무력화된다. 방화벽을 뚫지 않아도 유출된 IAM 자격증명 하나로 S3 버킷 전체를 내려받고, EC2 인스턴스를 띄우고, 비용을 수백만 원 발생시킬 수 있다.

Palo Alto Unit42(2023) 보고서에 따르면 AWS 침해 사고의 74%는 IAM 잘못된 설정이 원인이었다. 주요 패턴:

- **와일드카드 정책**: `"Action": ["*"]`, `"Resource": ["*"]`
- **루트 계정 일상 사용** + MFA 미설정
- **GitHub 코드에 Access Key 하드코딩**
- **과도한 EC2 인스턴스 프로파일** (EC2에서 S3, RDS 전체 접근)
- **교차 계정 역할(Cross-Account Role) 과도한 신뢰**

## IAM 정책 최소 권한 적용

![IAM 정책 취약 vs 안전 비교](/assets/posts/websec-cloud-iam-misconfig-policy.svg)

실제 최소 권한 정책 작성:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ReadSpecificBucket",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-bucket",
        "arn:aws:s3:::my-app-bucket/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "ap-northeast-2"
        }
      }
    }
  ]
}
```

조건부 제한을 활용해 특정 리전, 특정 IP, 특정 시간대에만 허용할 수 있다.

## 루트 계정 보호

```bash
# AWS CLI: 루트 계정 MFA 상태 확인
aws iam get-account-summary \
  --query 'SummaryMap.AccountMFAEnabled'

# 루트 계정에 액세스 키가 있으면 즉시 삭제
aws iam list-virtual-mfa-devices \
  --query 'VirtualMFADevices[?contains(SerialNumber, `root`)]'

# SCP로 루트 계정 API 호출 차단 (Organizations)
{
  "Effect": "Deny",
  "Action": "*",
  "Resource": "*",
  "Condition": {
    "StringLike": {
      "aws:PrincipalArn": "arn:aws:iam::*:root"
    }
  }
}
```

## Access Key 노출 대응

```bash
# 1. GitGuardian / truffleHog으로 레포 스캔
trufflehog github --repo https://github.com/yourorg/yourrepo

# 2. AWS Credential 노출 즉시 대응 절차
# a. 노출된 키 비활성화 (삭제 전 비활성화로 영향 확인)
aws iam update-access-key \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --status Inactive

# b. CloudTrail에서 해당 키 사용 이력 조회
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=AccessKeyId,\
AttributeValue=AKIAIOSFODNN7EXAMPLE \
  --start-time 2024-01-01 \
  --query 'Events[*].{Time:EventTime,Event:EventName,IP:CloudTrailEvent}'

# c. 이상 API 호출 확인 후 키 삭제
aws iam delete-access-key \
  --access-key-id AKIAIOSFODNN7EXAMPLE
```

## IRSA: EC2/EKS에서 키 없이 권한 부여

```python
# 나쁜 방법: 환경변수에 액세스 키 하드코딩
import boto3
session = boto3.Session(
    aws_access_key_id="AKIA...",
    aws_secret_access_key="wJalr..."
)

# 올바른 방법: IAM Role 자동 적용 (EC2 Instance Profile / IRSA)
import boto3
# 환경 내 IAM Role이 자동으로 적용됨
s3 = boto3.client("s3")  # 자격증명 명시 불필요
response = s3.get_object(Bucket="my-bucket", Key="file.txt")
```

EKS에서는 IRSA(IAM Roles for Service Accounts)를 사용해 Pod 단위로 IAM 역할을 부여한다:

```yaml
# ServiceAccount에 IAM Role 어노테이션
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/MyAppRole
```

## IAM Access Analyzer + CloudTrail 감사

```bash
# IAM Access Analyzer: 외부 공개 리소스 탐지
aws accessanalyzer list-findings \
  --analyzer-name my-analyzer \
  --filter '{"status": {"eq": ["ACTIVE"]}}' \
  --query 'findings[*].{Type:findingType,Resource:resource}'

# CloudTrail Insights: 비정상 API 호출 자동 탐지 활성화
aws cloudtrail put-insight-selectors \
  --trail-name my-trail \
  --insight-selectors '[{"InsightType": "ApiCallRateInsight"},
                        {"InsightType": "ApiErrorRateInsight"}]'

# Athena로 특정 IP의 비정상 API 패턴 쿼리
SELECT eventtime, eventname, sourceipaddress, useridentity.arn
FROM cloudtrail_logs
WHERE sourceipaddress NOT IN ('10.0.0.0/8')
  AND eventname IN ('GetSecretValue','ListBuckets','DescribeInstances')
ORDER BY eventtime DESC
LIMIT 100;
```

## Service Control Policies (SCP)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyLeaveOrganization",
      "Effect": "Deny",
      "Action": "organizations:LeaveOrganization",
      "Resource": "*"
    },
    {
      "Sid": "DenyDisableCloudTrail",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:StopLogging",
        "cloudtrail:DeleteTrail",
        "cloudtrail:UpdateTrail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RegionLock",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": ["ap-northeast-2", "us-east-1"]
        }
      }
    }
  ]
}
```

SCP는 계정 내 모든 IAM 주체(루트 포함)에 적용되며, 해당 계정에서 실행 가능한 최대 권한의 경계선을 설정한다.

---

**지난 글:** [컨테이너 보안: Docker·Kubernetes 취약점과 방어 전략](/posts/websec-container-security/)

**다음 글:** [스토리지 버킷 잘못된 설정: S3 공개 노출 방어](/posts/websec-storage-bucket-misconfig/)

<br>
읽어주셔서 감사합니다. 😊
