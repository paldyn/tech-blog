---
title: "AWS ECR 완전 정복: 인증·수명 주기·스캔"
description: "AWS ECR(Elastic Container Registry)의 인증 방식, 레포지토리 관리, 수명 주기 정책, 이미지 스캔, IAM 권한 설정까지 실전 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "aws", "ecr", "IAM", "lifecycle", "이미지스캔", "레지스트리", "CI/CD"]
featured: false
draft: false
---

[지난 글](/posts/docker-registry-self-host/)에서 Harbor로 자체 레지스트리를 운영하는 방법을 살펴봤다. AWS 인프라를 주로 사용한다면 ECR(Elastic Container Registry)이 가장 자연스러운 선택이다. IAM과 긴밀하게 통합되어 별도 사용자 관리가 필요 없고, EKS·ECS와 자동으로 연동된다.

## ECR 기본 구조

ECR은 **레지스트리 → 레포지토리 → 이미지** 계층으로 구성된다.

- 레지스트리 URL: `{account-id}.dkr.ecr.{region}.amazonaws.com`
- 레포지토리: `myteam/myapp` 형태의 네임스페이스
- 이미지: `레지스트리/레포지토리:태그` 또는 `@sha256:digest`

ECR Public Gallery(`public.ecr.aws`)는 인증 없이 pull 가능한 퍼블릭 레지스트리로, Docker Hub 대안으로 Rate Limit 걱정 없이 사용할 수 있다.

![AWS ECR 구조 및 인증 흐름](/assets/posts/docker-aws-ecr-overview.svg)

## 레포지토리 생성

```bash
# 레포지토리 생성
aws ecr create-repository \
  --repository-name myteam/myapp \
  --region ap-northeast-2 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# 결과에서 repositoryUri 확인
# {account}.dkr.ecr.ap-northeast-2.amazonaws.com/myteam/myapp
```

## 인증: 12시간 토큰

ECR은 일반 사용자명/비밀번호 방식이 아닌, IAM을 통해 12시간 유효한 임시 토큰을 발급한다.

```bash
# 방법 1: 직접 파이프
aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin \
    123456789012.dkr.ecr.ap-northeast-2.amazonaws.com

# 방법 2: 변수 활용 (스크립트에서)
TOKEN=$(aws ecr get-login-password --region ap-northeast-2)
echo "$TOKEN" | docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com

# 방법 3: amazon-ecr-credential-helper (자동 갱신, 추천)
# ~/.docker/config.json에 설정하면 토큰을 자동으로 갱신
```

CI/CD 환경에서는 `amazon-ecr-credential-helper`를 설치하면 토큰 만료를 신경 쓰지 않아도 된다.

```json
// ~/.docker/config.json
{
  "credHelpers": {
    "123456789012.dkr.ecr.ap-northeast-2.amazonaws.com": "ecr-login"
  }
}
```

## push / pull

```bash
REPO="123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/myteam/myapp"

# 빌드 & 태그
docker build -t myapp:1.0 .
docker tag myapp:1.0 "${REPO}:1.0"
docker tag myapp:1.0 "${REPO}:latest"

# push
docker push "${REPO}:1.0"
docker push "${REPO}:latest"

# pull (EC2/ECS/EKS는 IAM 역할로 자동 인증)
docker pull "${REPO}:1.0"
```

## IAM 정책 설정

CI 서비스 계정에 최소 권한 원칙을 적용하는 것이 중요하다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:ap-northeast-2:123456789012:repository/myteam/myapp"
    }
  ]
}
```

ECS 태스크나 EKS Pod에서 pull만 하는 경우 `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` 3개만 있으면 충분하다.

## 수명 주기 정책: 스토리지 비용 절감

ECR 이미지는 S3에 저장되므로 관리하지 않으면 비용이 계속 쌓인다. 수명 주기 정책으로 오래된 이미지를 자동 삭제한다.

![ECR 수명 주기 정책 예시](/assets/posts/docker-aws-ecr-lifecycle.svg)

```bash
# 정책 파일 작성 후 적용
cat > ecr-lifecycle.json << 'EOF'
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "태그 없는 이미지 1일 후 삭제",
      "selection": {
        "tagStatus": "untagged",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 1
      },
      "action": {"type": "expire"}
    },
    {
      "rulePriority": 2,
      "description": "v-태그 이미지 최근 20개만 유지",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["v"],
        "countType": "imageCountMoreThan",
        "countNumber": 20
      },
      "action": {"type": "expire"}
    }
  ]
}
EOF

aws ecr put-lifecycle-policy \
  --repository-name myteam/myapp \
  --lifecycle-policy-text file://ecr-lifecycle.json
```

## 이미지 취약점 스캔

ECR은 두 가지 스캔 방식을 지원한다.

```bash
# 기본 스캔 (레포지토리별 설정)
aws ecr put-image-scanning-configuration \
  --repository-name myteam/myapp \
  --image-scanning-configuration scanOnPush=true

# 스캔 결과 조회
aws ecr describe-image-scan-findings \
  --repository-name myteam/myapp \
  --image-id imageTag=1.0 \
  --query 'imageScanFindings.findings[?severity==`CRITICAL`]' \
  --output table

# Enhanced 스캔 (Inspector v2, 레지스트리 전체 활성화)
aws ecr put-registry-scanning-configuration \
  --scan-type ENHANCED \
  --rules '[{"repositoryFilters": [{"filter": "*", "filterType": "WILDCARD"}], "scanFrequency": "CONTINUOUS_SCAN"}]'
```

Enhanced Scanning은 Amazon Inspector v2를 사용하며 OS 패키지뿐 아니라 애플리케이션 의존성(npm, pip, gem 등)까지 스캔한다.

## GitHub Actions 통합

```yaml
# .github/workflows/build-push.yml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/ecr-push-role
    aws-region: ap-northeast-2

- name: Login to Amazon ECR
  id: login-ecr
  uses: aws-actions/amazon-ecr-login@v2

- name: Build, tag, and push image
  env:
    ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
    IMAGE_TAG: ${{ github.sha }}
  run: |
    docker build -t $ECR_REGISTRY/myteam/myapp:$IMAGE_TAG .
    docker push $ECR_REGISTRY/myteam/myapp:$IMAGE_TAG
```

OIDC(OpenID Connect)를 통해 IAM 역할을 사용하면 AWS 자격증명을 GitHub Secrets에 저장하지 않아도 된다. `role-to-assume`에 OIDC 신뢰 관계가 설정된 역할 ARN을 지정한다.

## 크로스 계정 접근

개발/스테이징/프로덕션 계정이 분리된 환경에서는 레포지토리 정책으로 다른 AWS 계정의 접근을 허용할 수 있다.

```bash
aws ecr set-repository-policy \
  --repository-name myteam/myapp \
  --policy-text '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::987654321098:root"},
      "Action": ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
    }]
  }'
```

---

**지난 글:** [Harbor로 엔터프라이즈 레지스트리 구축하기](/posts/docker-registry-self-host/)

**다음 글:** [GCP Artifact Registry: Docker 이미지 저장과 CI/CD 통합](/posts/docker-gcp-artifact-registry/)

<br>
읽어주셔서 감사합니다. 😊
