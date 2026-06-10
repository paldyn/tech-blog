---
title: "Helm 의존성 관리 — Chart.lock과 서브차트 완전 이해"
description: "Helm Chart.yaml의 dependencies 필드, helm dependency update/build 명령어, Chart.lock을 통한 버전 고정, condition/tags/alias로 서브차트 제어하는 방법을 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["Helm", "HelmDependencies", "서브차트", "ChartLock", "Kubernetes", "패키지관리"]
featured: false
draft: false
---

[지난 글](/posts/k8s-helm-hooks/)에서 Helm Hook으로 배포 라이프사이클을 확장하는 방법을 살펴봤다. 이번 글에서는 Helm의 의존성 관리 기능을 심층적으로 다룬다. 실제 프로덕션 차트는 PostgreSQL, Redis, Nginx Ingress 같은 외부 차트를 서브차트로 포함하는 경우가 많은데, 이를 체계적으로 관리하는 방법을 알아본다.

## 왜 Helm 의존성 관리가 중요한가

마이크로서비스 환경에서 애플리케이션은 데이터베이스, 캐시, 메시지 브로커 같은 인프라 컴포넌트에 의존한다. 이 컴포넌트들을 직접 YAML로 관리하면 버전 관리, 설정 오버라이드, 환경별 활성화가 번거로워진다. Helm의 의존성 관리는 이런 외부 차트를 `Chart.yaml` 한 파일에서 선언적으로 관리하고, `Chart.lock`으로 정확한 버전을 고정하며, `values.yaml`을 통해 서브차트 설정을 통합 관리할 수 있게 해준다.

![Helm 의존성 구조](/assets/posts/k8s-helm-dependencies-chart.svg)

## Chart.yaml에 의존성 선언하기

의존성은 `Chart.yaml`의 `dependencies` 블록에 선언한다.

```yaml
# Chart.yaml
apiVersion: v2
name: my-app
version: 1.0.0
type: application

dependencies:
  - name: postgresql
    version: "13.2.0"
    repository: "https://charts.bitnami.com/bitnami"
  - name: redis
    version: ">=18.0.0 <19.0.0"
    repository: "oci://registry-1.docker.io/bitnamicharts"
    alias: cache
  - name: ingress-nginx
    version: "4.9.0"
    repository: "https://kubernetes.github.io/ingress-nginx"
    condition: ingress.enabled
```

각 의존성에는 `name`, `version`, `repository` 세 필드가 필수다. `version`은 SemVer 범위(`>=18.0.0 <19.0.0`)도 지원하지만, 프로덕션에서는 재현성을 위해 정확한 버전을 명시하는 것이 좋다.

## helm dependency 명령어 워크플로우

```bash
# 1. 의존성 차트 다운로드 (charts/ 디렉토리에 .tgz로 저장)
helm dependency update ./my-app

# 2. Chart.lock 파일로 정확한 버전 재현 (CI 환경에서 사용)
helm dependency build ./my-app

# 3. 현재 의존성 상태 확인
helm dependency list ./my-app

# 4. 설치 시 자동으로 의존성 업데이트
helm install my-release ./my-app --dependency-update
```

`helm dependency update`는 `Chart.yaml`의 version 범위에서 최신 버전을 다운로드하고, `Chart.lock`을 새로 생성하거나 업데이트한다. `helm dependency build`는 이미 존재하는 `Chart.lock`을 기반으로 정확히 같은 버전을 재현한다. CI/CD에서는 반드시 `build`를 사용해 재현성을 보장해야 한다.

## Chart.lock — 버전 고정의 핵심

`Chart.lock`은 실제로 다운로드된 버전을 기록한다.

```yaml
# Chart.lock (자동 생성, VCS에 커밋 필수)
dependencies:
  - name: postgresql
    repository: https://charts.bitnami.com/bitnami
    version: 13.2.0
  - name: redis
    repository: oci://registry-1.docker.io/bitnamicharts
    version: 18.1.3        # 범위 중 실제 설치된 버전
    alias: cache
  - name: ingress-nginx
    repository: https://kubernetes.github.io/ingress-nginx
    version: 4.9.0
digest: sha256:abc123...   # 의존성 전체 해시
generated: "2026-06-11T..."
```

`Chart.lock`은 VCS(Git)에 반드시 커밋해야 한다. `charts/` 디렉토리 안의 `.tgz` 파일들은 커밋하지 않고 `.helmignore`에 추가하거나, 반대로 오프라인 환경 지원을 위해 커밋하는 방식 중 팀 정책에 맞게 선택한다.

## 서브차트 조건 제어와 values 전달

![서브차트 조건 제어](/assets/posts/k8s-helm-dependencies-conditions.svg)

`condition`, `tags`, `alias` 세 필드로 서브차트를 세밀하게 제어할 수 있다.

```yaml
# values.yaml — 서브차트 제어 및 설정 전달
# condition 필드로 단일 차트 활성화 제어
ingress:
  enabled: false     # ingress-nginx 차트 비활성화

# 서브차트 이름(또는 alias)으로 값 전달
postgresql:
  auth:
    username: appuser
    password: securepassword
    database: myapp
  primary:
    resources:
      requests:
        memory: 256Mi
        cpu: 250m

cache:              # alias: cache 로 지정된 redis 설정
  auth:
    enabled: true
    password: redispass
  master:
    persistence:
      size: 8Gi
```

서브차트 `values`는 부모 차트의 `values.yaml`에서 서브차트 이름(또는 alias)을 키로 사용해 오버라이드한다. 서브차트의 자체 `values.yaml`보다 부모 차트의 값이 항상 우선한다.

## tags를 이용한 그룹 제어

```yaml
# Chart.yaml
dependencies:
  - name: redis
    version: "18.x.x"
    repository: "..."
    tags:
      - cache
      - optional
  - name: memcached
    version: "6.x.x"
    repository: "..."
    tags:
      - cache

# values.yaml
tags:
  cache: false    # cache 태그가 붙은 redis, memcached 모두 비활성화
  optional: true  # optional 태그는 활성화 (condition이 없으면 tags 적용)
```

`condition` 필드가 있는 차트는 조건이 `tags`보다 우선한다. `condition` 필드가 없는 차트만 `tags`의 영향을 받는다.

## 서브차트와 글로벌 값

여러 서브차트가 공유해야 하는 값은 `global` 키를 사용한다.

```yaml
# values.yaml
global:
  imageRegistry: "my-registry.example.com"
  imagePullSecrets:
    - name: regcred
  storageClass: "fast-ssd"

# 모든 서브차트에서 .Values.global.imageRegistry 로 접근 가능
```

`global` 값은 부모 차트와 모든 서브차트에서 `.Values.global.*`로 접근할 수 있다. 내부 컨테이너 레지스트리 주소, 공통 스토리지 클래스, 공통 이미지 풀 시크릿 등에 유용하다.

## 실전 팁 — .helmignore와 charts/ 디렉토리

```bash
# .helmignore — charts/ 디렉토리의 tgz 파일 무시 여부
# 방식 1: tgz 무시 (helm dep update로 재생성)
charts/*.tgz

# 방식 2: tgz 커밋 (오프라인/에어갭 환경 지원)
# .helmignore에 추가하지 않음

# 차트 패키징 전 의존성 확인
helm lint ./my-app
helm template my-release ./my-app --dry-run | head -100
```

프로덕션 GitOps 파이프라인에서는 `Chart.lock`을 커밋하고 CI에서 `helm dependency build`를 실행하는 방식이 가장 재현성이 높다. `helm dependency update`는 개발자가 로컬에서 의존성을 추가하거나 업그레이드할 때만 실행한다.

---

**지난 글:** [Helm Hook — 배포 라이프사이클 확장](/posts/k8s-helm-hooks/)

**다음 글:** [Helm Values 전략 — 환경별 오버라이드와 시크릿 분리](/posts/k8s-helm-values-strategy/)

<br>
읽어주셔서 감사합니다. 😊
