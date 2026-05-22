---
title: "Harbor로 엔터프라이즈 레지스트리 구축하기"
description: "Harbor를 이용한 엔터프라이즈급 컨테이너 레지스트리 구축, RBAC 설정, 이미지 복제, 취약점 스캔, 고가용성 배포 방법을 실전 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "harbor", "registry", "RBAC", "replication", "trivy", "보안", "레지스트리"]
featured: false
draft: false
---

[지난 글](/posts/docker-private-registry/)에서 `registry:2`로 기본 프라이빗 레지스트리를 구축하는 방법을 다뤘다. 소규모 팀에는 충분하지만, 팀이 커지면 사용자 권한 관리, 이미지 보안 스캔, 다중 사이트 복제 같은 기능이 필요해진다. Harbor는 이 모든 것을 오픈소스로 제공하는 엔터프라이즈 레지스트리다.

## Harbor 개요

Harbor는 CNCF 졸업 프로젝트로, Docker Distribution(registry:2) 위에 다음 기능을 추가한다:

- **RBAC**: 프로젝트별 세밀한 역할 기반 접근 제어
- **취약점 스캔**: Trivy 통합으로 이미지 CVE 자동 탐지
- **이미지 서명**: Notary/Cosign 통합
- **복제(Replication)**: 다른 레지스트리와 자동 동기화
- **웹 UI**: 이미지/태그 관리, 감사 로그

![Harbor 엔터프라이즈 레지스트리 아키텍처](/assets/posts/docker-registry-self-host-arch.svg)

## 설치: Docker Compose 방식

Harbor는 공식 설치 스크립트로 배포한다.

```bash
# 최신 릴리즈 다운로드
VERSION=$(curl -s https://api.github.com/repos/goharbor/harbor/releases/latest \
  | grep '"tag_name"' | cut -d'"' -f4)
curl -LO "https://github.com/goharbor/harbor/releases/download/${VERSION}/harbor-online-installer-${VERSION}.tgz"
tar xzf harbor-online-installer-${VERSION}.tgz
cd harbor
```

```yaml
# harbor.yml (최소 설정)
hostname: registry.example.com
http:
  port: 80
https:
  port: 443
  certificate: /etc/harbor/ssl/registry.crt
  private_key: /etc/harbor/ssl/registry.key
harbor_admin_password: ChangeMeStrongPassword!
database:
  password: ChangeDBPassword!
data_volume: /data/harbor
```

```bash
sudo ./install.sh --with-trivy
```

설치가 완료되면 `https://registry.example.com`에서 웹 UI에 접근할 수 있다. 초기 로그인은 `admin` / `harbor.yml`에 설정한 비밀번호.

## RBAC: 프로젝트와 사용자 역할

Harbor의 권한 모델은 **프로젝트(Project)** 단위로 동작한다. 프로젝트는 이미지의 네임스페이스 역할을 하며, 프로젝트별로 멤버를 초대하고 역할을 부여한다.

![Harbor RBAC 권한 모델](/assets/posts/docker-registry-self-host-rbac.svg)

```bash
# Harbor CLI(harbor-cli) 또는 API로 프로젝트 생성
curl -u admin:AdminPassword \
  -X POST "https://registry.example.com/api/v2.0/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "myteam",
    "public": false,
    "metadata": {"auto_scan": "true"}
  }'

# 사용자 추가 후 역할 부여 (role_id: 1=관리자, 2=개발자, 3=게스트, 4=메인테이너)
curl -u admin:AdminPassword \
  -X POST "https://registry.example.com/api/v2.0/projects/myteam/members" \
  -H "Content-Type: application/json" \
  -d '{"role_id": 2, "member_user": {"username": "alice"}}'
```

## 이미지 push/pull

```bash
# 로그인
docker login registry.example.com

# 이미지 태그 후 push
docker tag myapp:1.0 registry.example.com/myteam/myapp:1.0
docker push registry.example.com/myteam/myapp:1.0

# pull
docker pull registry.example.com/myteam/myapp:1.0
```

## 취약점 스캔: Trivy 통합

Harbor에서 `--with-trivy`로 설치하면 이미지 push 시 자동으로 CVE 스캔이 실행된다. 스캔 결과는 웹 UI와 API에서 확인 가능하다.

```bash
# API로 스캔 트리거
curl -u admin:AdminPassword \
  -X POST "https://registry.example.com/api/v2.0/projects/myteam/repositories/myapp/artifacts/1.0/scan"

# 스캔 결과 조회
curl -u admin:AdminPassword \
  "https://registry.example.com/api/v2.0/projects/myteam/repositories/myapp/artifacts/1.0/additions/vulnerabilities" \
  | python3 -m json.tool | head -40
```

심각도 임계값을 설정하면 Critical CVE가 있는 이미지의 pull을 차단할 수 있다. Harbor 웹 UI → 프로젝트 → 설정 → **취약점 스캔** → 심각도 차단 정책.

## 복제(Replication) 설정

복제는 Harbor의 핵심 기능으로, 다른 레지스트리(ECR, GCR, Docker Hub, 다른 Harbor)와 이미지를 자동 동기화한다.

```bash
# 복제 대상 레지스트리 등록
curl -u admin:AdminPassword \
  -X POST "https://registry.example.com/api/v2.0/registries" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "aws-ecr-prod",
    "type": "aws-ecr",
    "url": "https://123456789.dkr.ecr.ap-northeast-2.amazonaws.com",
    "credential": {
      "access_key": "AKIAIOSFODNN7EXAMPLE",
      "access_secret": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    }
  }'

# 복제 정책 생성 (push 시 자동 복제)
curl -u admin:AdminPassword \
  -X POST "https://registry.example.com/api/v2.0/replication/policies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sync-to-ecr",
    "src_registry": null,
    "dest_registry": {"id": 1},
    "dest_namespace": "myteam",
    "trigger": {"type": "event_based", "trigger_settings": {}},
    "filters": [{"type": "tag", "value": "v*"}],
    "enabled": true
  }'
```

## 가비지 컬렉션

tag가 없는 매니페스트(untagged manifest)가 쌓이면 스토리지를 낭비한다. Harbor UI 또는 API로 GC를 예약 실행할 수 있다.

```bash
# GC 즉시 실행
curl -u admin:AdminPassword \
  -X POST "https://registry.example.com/api/v2.0/system/gc" \
  -H "Content-Type: application/json" \
  -d '{"parameters": {"delete_untagged": true}, "schedule": {"type": "Manual"}}'
```

## 고가용성 배포 고려사항

단일 노드 Harbor는 데이터베이스/스토리지 장애에 취약하다. 고가용성을 위한 핵심 구성:

- **PostgreSQL HA**: `pgsql.external_url`로 외부 Patroni/RDS를 사용
- **Redis**: `external_redis`로 Redis Sentinel/Cluster 연결
- **스토리지**: `data_volume` 대신 S3/GCS로 공유 스토리지 사용
- **Harbor 코어**: 로드밸런서 뒤에 여러 인스턴스 실행

```yaml
# harbor.yml - 외부 DB/Redis 설정
external_database:
  host: postgres-ha.internal
  port: 5432
  username: harbor
  password: DBPassword
  database: harbor_registry

external_redis:
  host: redis-sentinel.internal:26379
  sentinel_master_set: mymaster
```

---

**지난 글:** [프라이빗 레지스트리 구축과 운영](/posts/docker-private-registry/)

**다음 글:** [AWS ECR 완전 정복: 인증·수명 주기·스캔](/posts/docker-aws-ecr/)

<br>
읽어주셔서 감사합니다. 😊
