---
title: "Helm으로 쿠버네티스 패키지 관리하기"
description: "Helm의 개념(Chart, Repository, Release), helm install/upgrade/rollback 기본 명령, values.yaml 커스터마이징, 실전 Chart 구성 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "helm", "chart", "패키지관리", "배포"]
featured: false
draft: false
---

[지난 글](/posts/k8s-namespace/)에서 Namespace로 클러스터 자원을 논리적으로 분리하는 방법을 다뤘다. 이제 실제 애플리케이션을 클러스터에 배포할 때 반복되는 YAML 관리 문제를 해결해 줄 도구가 필요하다. **Helm**은 쿠버네티스의 패키지 매니저로, 복잡한 애플리케이션 배포를 재사용 가능한 단위(Chart)로 묶어 설치·업그레이드·롤백을 명령 한 줄로 처리한다.

## Helm의 핵심 개념

![Helm 아키텍처](/assets/posts/k8s-helm-overview-architecture.svg)

Helm은 세 가지 개념으로 이루어진다. **Chart**는 K8s manifest 파일들의 묶음이다. **Repository**는 Chart를 보관하는 저장소(Artifact Hub, 사내 Harbor 등)이다. **Release**는 Chart를 클러스터에 실제 설치한 인스턴스다. 같은 Chart를 여러 번 설치하면 Release 이름이 달라지며 독립적으로 관리된다.

```bash
# Helm 설치 (Linux)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 버전 확인
helm version
# version.BuildInfo{Version:"v3.x.x", ...}

# Bitnami 저장소 추가
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 사용 가능한 Chart 검색
helm search repo bitnami/nginx
```

## 기본 명령: install / upgrade / rollback

```bash
# Chart 설치 — 새 Release 생성
helm install my-nginx bitnami/nginx \
  --namespace production \
  --create-namespace \
  --set replicaCount=2

# Release 목록 확인
helm list -n production

# 업그레이드 (값 변경 포함)
helm upgrade my-nginx bitnami/nginx \
  --namespace production \
  --set replicaCount=3 \
  --set image.tag=1.25.0

# 롤백 — 특정 리비전으로 되돌리기
helm history my-nginx -n production   # 리비전 목록
helm rollback my-nginx 1 -n production  # 리비전 1로 롤백

# Release 삭제
helm uninstall my-nginx -n production
```

## Chart 구조

![Helm Chart 디렉터리 구조](/assets/posts/k8s-helm-overview-chart.svg)

`helm create mychart`로 기본 골격이 생성된다. `Chart.yaml`에 메타데이터, `values.yaml`에 기본값, `templates/`에 Go 템플릿 형식의 K8s manifest가 들어간다.

```yaml
# Chart.yaml 예시
apiVersion: v2
name: mychart
description: My first Helm chart
type: application
version: 0.1.0        # Chart 버전
appVersion: "1.0.0"   # 애플리케이션 버전
```

## values.yaml과 오버라이드

```yaml
# values.yaml (기본값)
replicaCount: 1

image:
  repository: nginx
  tag: "1.24.0"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

resources:
  limits:
    cpu: 200m
    memory: 128Mi
```

```bash
# -f로 파일 오버라이드
helm install my-app ./mychart \
  -f values-production.yaml

# --set으로 개별 값 오버라이드 (점 표기법)
helm install my-app ./mychart \
  --set image.tag=2.0.0 \
  --set replicaCount=3

# 적용될 manifest 미리 보기 (dry-run)
helm install my-app ./mychart --dry-run
helm template my-app ./mychart   # 렌더링 결과만 출력
```

## 템플릿 문법 기초

`templates/deployment.yaml`에서 Go 템플릿 문법으로 값을 참조한다.

```yaml
# templates/deployment.yaml 발췌
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - containerPort: {{ .Values.service.port }}
```

`_helpers.tpl`에 정의한 named template은 `{{ include "mychart.fullname" . }}`로 재사용한다.

## 의존성(Dependency) 관리

다른 Chart를 하위 의존성으로 선언할 수 있다. 예를 들어 앱 Chart가 PostgreSQL Chart에 의존하는 패턴이 흔하다.

```yaml
# Chart.yaml에 의존성 선언
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
```

```bash
# 의존성 다운로드 → charts/ 디렉터리에 저장
helm dependency update ./mychart

# 빌드 (charts/*.tgz 재패키징)
helm dependency build ./mychart
```

## 실전 패턴: 환경별 values 파일

```
mychart/
├── values.yaml            # 공통 기본값
├── values-staging.yaml    # 스테이징 오버라이드
└── values-production.yaml # 프로덕션 오버라이드
```

```bash
# 스테이징 배포
helm upgrade --install myapp ./mychart \
  -f values.yaml \
  -f values-staging.yaml \
  --namespace staging

# 프로덕션 배포
helm upgrade --install myapp ./mychart \
  -f values.yaml \
  -f values-production.yaml \
  --namespace production
```

`--install` 플래그는 Release가 없으면 install, 있으면 upgrade를 자동으로 선택한다. CI/CD 파이프라인에서 항상 이 형태를 쓰면 idempotent하게 동작한다.

## 유용한 디버그 명령

```bash
# 현재 적용된 values 확인
helm get values my-app -n production

# 현재 적용된 manifest 전체 확인
helm get manifest my-app -n production

# Release 상태 확인
helm status my-app -n production

# Chart 패키징
helm package ./mychart
# mychart-0.1.0.tgz 생성

# 패키지를 Repository에 업로드 (ChartMuseum 예)
helm push mychart-0.1.0.tgz oci://registry.example.com/charts
```

---

**지난 글:** [쿠버네티스 Namespace로 클러스터 격리하기](/posts/k8s-namespace/)

**다음 글:** [Docker CI 기초 — 컨테이너로 빌드 파이프라인 구성하기](/posts/docker-ci-basics/)

<br>
읽어주셔서 감사합니다. 😊
