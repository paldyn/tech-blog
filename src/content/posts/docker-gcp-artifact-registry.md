---
title: "GCP Artifact Registry: Docker 이미지 저장과 CI/CD 통합"
description: "GCP Artifact Registry에서 Docker 이미지를 저장·관리하는 방법, 인증 방식, Cloud Build 연동, Workload Identity 설정, 정리 정책까지 실전 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "gcp", "artifact-registry", "cloud-build", "GKE", "workload-identity", "레지스트리"]
featured: false
draft: false
---

[지난 글](/posts/docker-aws-ecr/)에서 AWS ECR을 살펴봤다. GCP 인프라를 사용한다면 Artifact Registry(AR)가 그 역할을 한다. 기존 Container Registry(GCR, `gcr.io`)를 대체하는 차세대 서비스로, Docker 이미지 외에도 Maven, npm, Python 패키지를 한 곳에서 관리할 수 있다.

## GCR vs Artifact Registry

GCR(`gcr.io`)은 2024년 이후 신규 GCP 프로젝트에서 기본 비활성화됐다. 신규 프로젝트는 Artifact Registry를 사용해야 한다. URI 형식이 다르므로 마이그레이션 시 주의가 필요하다.

![GCP Artifact Registry 구조](/assets/posts/docker-gcp-artifact-registry-overview.svg)

## 레포지토리 생성

```bash
# Artifact Registry API 활성화
gcloud services enable artifactregistry.googleapis.com

# 레포지토리 생성
gcloud artifacts repositories create my-docker-repo \
  --repository-format=docker \
  --location=asia-northeast3 \
  --description="팀 Docker 이미지 저장소"

# 레포지토리 목록 확인
gcloud artifacts repositories list --location=asia-northeast3
```

이미지 URI는 `{location}-docker.pkg.dev/{project-id}/{repo-name}/{image}:{tag}` 형식이다.

## 인증 설정

```bash
# 방법 1: gcloud CLI (로컬 개발 환경)
gcloud auth configure-docker asia-northeast3-docker.pkg.dev

# ~/.docker/config.json에 credHelper 자동 추가됨
# "asia-northeast3-docker.pkg.dev": "gcloud"

# 방법 2: 서비스 계정 키 파일 (CI/CD 외부)
cat KEY_FILE.json | docker login -u _json_key --password-stdin \
  https://asia-northeast3-docker.pkg.dev

# 방법 3: 액세스 토큰 (단기 인증)
ACCESS_TOKEN=$(gcloud auth print-access-token)
echo "$ACCESS_TOKEN" | docker login -u oauth2accesstoken --password-stdin \
  https://asia-northeast3-docker.pkg.dev
```

## push / pull

```bash
AR="asia-northeast3-docker.pkg.dev/my-project/my-docker-repo"

# 빌드 & 태그
docker build -t myapp:1.0 .
docker tag myapp:1.0 "${AR}/myapp:1.0"

# push
docker push "${AR}/myapp:1.0"

# 이미지 목록 확인
gcloud artifacts docker images list "${AR}/myapp"

# pull
docker pull "${AR}/myapp:1.0"
```

## Cloud Build 통합

Cloud Build는 빌드 서비스 계정이 Artifact Registry에 자동으로 접근할 수 있다. 별도 인증 설정 없이 cloudbuild.yaml만 작성하면 된다.

![Cloud Build → Artifact Registry 워크플로우](/assets/posts/docker-gcp-artifact-registry-workflow.svg)

```bash
# Cloud Build 트리거 생성 (GitHub 연동)
gcloud builds triggers create github \
  --name="build-on-push" \
  --repo-name="my-repo" \
  --repo-owner="my-org" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"
```

## GKE Workload Identity 설정

GKE 파드가 키 파일 없이 Artifact Registry에서 이미지를 pull하려면 Workload Identity를 설정한다.

```bash
# 서비스 계정 생성
gcloud iam service-accounts create ar-puller \
  --display-name="Artifact Registry Puller"

# Artifact Registry Reader 역할 부여
gcloud projects add-iam-policy-binding my-project \
  --member="serviceAccount:ar-puller@my-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"

# GKE 서비스 계정과 IAM 서비스 계정 연결
gcloud iam service-accounts add-iam-policy-binding \
  ar-puller@my-project.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:my-project.svc.id.goog[default/my-ksa]"
```

```yaml
# Kubernetes ServiceAccount 어노테이션
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-ksa
  namespace: default
  annotations:
    iam.gke.io/gcp-service-account: ar-puller@my-project.iam.gserviceaccount.com
```

이후 파드 spec에 `serviceAccountName: my-ksa`를 지정하면 이미지 pull 시 자동으로 IAM 인증이 이루어진다.

## 정리 정책 (Cleanup Policies)

Artifact Registry는 ECR의 수명 주기 정책과 유사한 정리 정책을 지원한다.

```bash
# 정책 파일 생성
cat > cleanup-policy.json << 'EOF'
[
  {
    "name": "delete-old-untagged",
    "action": {"type": "Delete"},
    "condition": {
      "tagState": "untagged",
      "olderThan": "86400s"
    }
  },
  {
    "name": "keep-recent-tagged",
    "action": {"type": "Keep"},
    "mostRecentVersions": {
      "keepCount": 10
    }
  }
]
EOF

# 정책 적용
gcloud artifacts repositories set-cleanup-policies my-docker-repo \
  --location=asia-northeast3 \
  --policy=cleanup-policy.json
```

## IAM 권한 관리

```bash
# 특정 서비스 계정에 push 권한
gcloud artifacts repositories add-iam-policy-binding my-docker-repo \
  --location=asia-northeast3 \
  --member="serviceAccount:ci-bot@my-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# 읽기 전용 (pull만)
gcloud artifacts repositories add-iam-policy-binding my-docker-repo \
  --location=asia-northeast3 \
  --member="serviceAccount:k8s-node@my-project.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"

# 레지스트리 현재 정책 확인
gcloud artifacts repositories get-iam-policy my-docker-repo \
  --location=asia-northeast3
```

## GitHub Actions 통합

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: 'projects/123/locations/global/workloadIdentityPools/my-pool/providers/github'
    service_account: 'ci-bot@my-project.iam.gserviceaccount.com'

- name: Set up Cloud SDK
  uses: google-github-actions/setup-gcloud@v2

- name: Configure Docker for Artifact Registry
  run: gcloud auth configure-docker asia-northeast3-docker.pkg.dev --quiet

- name: Build and push
  run: |
    docker build -t asia-northeast3-docker.pkg.dev/my-project/my-docker-repo/myapp:${{ github.sha }} .
    docker push asia-northeast3-docker.pkg.dev/my-project/my-docker-repo/myapp:${{ github.sha }}
```

---

**지난 글:** [AWS ECR 완전 정복: 인증·수명 주기·스캔](/posts/docker-aws-ecr/)

**다음 글:** [GitHub Container Registry: ghcr.io 완전 활용법](/posts/docker-github-container-registry/)

<br>
읽어주셔서 감사합니다. 😊
