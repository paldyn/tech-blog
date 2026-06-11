---
title: "Flux — GitOps 툴킷으로 구축하는 자동 배포"
description: "Flux의 컨트롤러 툴킷 구조(source·kustomize·helm·notification 컨트롤러), flux bootstrap으로 시작하기, GitRepository와 Kustomization·HelmRelease CRD 작성법, 이미지 자동 업데이트, Argo CD와의 철학 차이와 선택 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["Flux", "GitOps", "HelmRelease", "Kustomization", "CD", "배포자동화", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-argocd/)에서 다룬 Argo CD가 "UI를 갖춘 통합 GitOps 플랫폼"이라면, 이번 글의 주인공 **Flux**는 정반대 철학의 도구다. UI 없이, Kubernetes 네이티브 CRD와 독립 컨트롤러들의 조합으로 같은 문제를 푼다. GitOps라는 용어를 처음 만든 Weaveworks에서 출발한 원조 격 도구이며, Argo CD와 함께 CNCF 졸업 프로젝트다. 두 도구를 모두 알아야 팀에 맞는 선택을 할 수 있다.

## 툴킷이라는 설계 철학

Flux v2는 하나의 애플리케이션이 아니라 **GitOps Toolkit**이라 불리는 컨트롤러 묶음이다.

![Flux — 컨트롤러 툴킷 구조](/assets/posts/k8s-flux-arch.svg)

- **source-controller**: Git·Helm·OCI 저장소를 주기적으로 fetch해서 검증된 아티팩트로 만들어 다른 컨트롤러에게 공급한다
- **kustomize-controller**: `Kustomization` CRD를 보고 아티팩트를 빌드 → apply → prune → 헬스체크한다
- **helm-controller**: `HelmRelease` CRD를 보고 실제 Helm 릴리스를 설치·업그레이드한다
- **notification-controller**: 이벤트를 Slack 등으로 보내고, Git webhook을 받아 즉시 reconcile을 트리거한다
- **image-reflector / image-automation-controller**: 레지스트리의 새 이미지 태그를 감지해 Git에 수정 커밋을 자동 push한다 (선택 설치)

소스 가져오기와 적용하기가 분리되어 있다는 점이 Argo CD와의 구조적 차이다. 모든 상태가 CRD이므로 전용 UI 없이 `kubectl get`으로 모든 것을 조회할 수 있고, 권한도 Kubernetes RBAC을 그대로 쓴다.

## bootstrap — 자기 자신부터 GitOps로

Flux의 설치 명령 `flux bootstrap`은 단순 설치가 아니다. **Flux 자신의 매니페스트를 Git에 커밋하고, 그 Git을 바라보게 만든다.** 설치 첫 순간부터 Flux도 GitOps로 관리되는 것이다.

```bash
# CLI 설치
brew install fluxcd/tap/flux

# 사전 점검
flux check --pre

# GitHub 저장소에 부트스트랩
export GITHUB_TOKEN=<personal-access-token>
flux bootstrap github \
  --owner=my-org \
  --repository=k8s-config \
  --branch=main \
  --path=clusters/prod \
  --personal=false
```

실행이 끝나면 `k8s-config` 저장소의 `clusters/prod/flux-system/` 경로에 Flux 구성 요소 매니페스트가 커밋되고, 클러스터의 Flux가 이 경로를 watch하기 시작한다. 이후 `clusters/prod/` 아래에 추가하는 모든 매니페스트가 자동 배포 대상이 된다.

## 핵심 CRD 두 장 — GitRepository와 Kustomization

Flux에서 "무엇을 어디서 가져와 배포할지"는 두 CRD의 조합으로 선언한다.

```yaml
# 1. 소스 정의 — 어디서 가져올 것인가
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-api
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/example/k8s-config
  ref:
    branch: main
---
# 2. 적용 정의 — 무엇을 어떻게 배포할 것인가
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-api-prod
  namespace: flux-system
spec:
  interval: 10m
  sourceRef:
    kind: GitRepository
    name: my-api
  path: ./apps/my-api/overlays/prod
  prune: true            # Git에서 지워지면 클러스터에서도 삭제
  wait: true             # 리소스가 Ready 될 때까지 대기
  timeout: 5m
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: my-api
      namespace: prod
```

Argo CD의 Application 한 장이 하던 일을 두 장으로 나눈 셈인데, 분리 덕분에 하나의 소스를 여러 Kustomization이 공유하거나, Kustomization이 다른 Kustomization에 의존(`dependsOn`)하는 구성이 자연스럽다. `dependsOn`은 Argo CD의 Sync Wave에 해당하는 순서 제어 장치다.

```bash
# 상태 확인은 flux CLI 또는 kubectl로
flux get kustomizations
flux get sources git

# 즉시 동기화 (폴링 기다리지 않고)
flux reconcile kustomization my-api-prod --with-source

# 일시 중지 / 재개 (긴급 수동 작업 시)
flux suspend kustomization my-api-prod
flux resume kustomization my-api-prod
```

## HelmRelease — 진짜 Helm 릴리스를 관리한다

Helm 차트 배포에서 Flux와 Argo CD의 차이가 가장 크다. Argo CD는 `helm template`으로 렌더링한 YAML을 apply하므로 클러스터에 Helm 릴리스가 남지 않는다. 반면 Flux의 helm-controller는 **실제 helm install/upgrade를 실행**한다 — `helm list`에 릴리스가 보이고, 차트의 hook과 테스트가 온전히 동작한다.

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: grafana
  namespace: flux-system
spec:
  interval: 1h
  url: https://grafana.github.io/helm-charts
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: loki
  namespace: logging
spec:
  interval: 10m
  chart:
    spec:
      chart: loki
      version: "6.x"          # semver 범위 — 패치 자동 추적
      sourceRef:
        kind: HelmRepository
        name: grafana
        namespace: flux-system
  values:
    loki:
      storage:
        type: s3
  upgrade:
    remediation:
      retries: 3              # 실패 시 재시도
  rollback:
    cleanupOnFail: true       # 실패하면 자동 롤백
```

`version: "6.x"` 같은 semver 범위를 주면 새 패치 버전이 올라올 때 자동으로 따라간다. 시리즈에서 다뤘던 [Helm 차트](/posts/k8s-helm-overview/) 운영을 통째로 선언형으로 바꿔주는 CRD다.

## 이미지 자동 업데이트 — 내장 기능

[GitOps 입문](/posts/k8s-gitops-intro/)에서 "CI가 config repo에 태그 변경 커밋을 만든다"고 했는데, Flux는 이 단계를 컨트롤러로 내장했다. 레지스트리를 스캔해 정책에 맞는 새 태그를 발견하면 **Flux가 직접 Git에 커밋을 push**한다.

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: my-api
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: my-api
  policy:
    semver:
      range: ">=1.0.0"        # 최신 semver 태그 추적
```

매니페스트 쪽에는 마커 주석을 달아 어느 필드를 갱신할지 알려준다.

```yaml
spec:
  containers:
    - name: my-api
      image: registry.example.com/my-api:v1.4.1 # {"$imagepolicy": "flux-system:my-api"}
```

CI는 이미지 빌드·push까지만 책임지고, "배포 트리거 커밋"은 Flux가 만든다. Git 히스토리에는 `flux-bot`의 커밋이 남으므로 추적성도 유지된다.

## Flux vs Argo CD — 무엇을 고를까

![Flux vs Argo CD](/assets/posts/k8s-flux-vs-argocd.svg)

원칙(pull, 조정 루프, prune, self-heal)은 동일하므로 어느 쪽을 골라도 GitOps는 성립한다. 갈림길은 운영 스타일이다.

- **Argo CD를 고르는 이유**: 배포 상태를 보는 웹 UI가 필요한 팀(특히 개발자가 직접 배포 상태를 확인하는 문화), 멀티 테넌트 환경에서 AppProject·SSO로 경계를 긋고 싶은 경우, 리소스 트리 시각화와 UI 롤백의 편의
- **Flux를 고르는 이유**: 플랫폼 팀이 CRD 조합으로 인프라를 조립하는 스타일, 진짜 Helm 릴리스가 필요한 경우, 이미지 자동 업데이트 내장, 더 가벼운 풋프린트, Kubernetes RBAC 일원화

둘을 섞는 패턴도 있다 — 인프라 애드온(모니터링, 로깅, 인그레스)은 Flux의 HelmRelease로, 애플리케이션 배포는 Argo CD로 운영하는 식이다. 도구는 수단이고, 지켜야 할 것은 "진실은 Git에 있다"는 원칙이다.

## 마무리

Flux는 GitOps를 Kubernetes의 문법 그대로 — CRD와 컨트롤러로 — 구현한 도구다. bootstrap으로 자기 자신부터 Git 관리에 넣고, GitRepository + Kustomization으로 배포를 선언하며, HelmRelease로 차트까지 선언형으로 다룬다. 이제 Git 머지가 곧 배포인 세계에 도착했다. 그렇다면 새 버전을 한 번에 전체로 내보내지 않고, 일부 트래픽으로 검증하며 점진적으로 확대할 수는 없을까? 다음 글에서 카나리 배포와 블루-그린을 자동화하는 **프로그레시브 딜리버리**로 이어진다.

---

**지난 글:** [Argo CD — 선언적 GitOps 지속 배포](/posts/k8s-argocd/)

<br>
읽어주셔서 감사합니다. 😊
