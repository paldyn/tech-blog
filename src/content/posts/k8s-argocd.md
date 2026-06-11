---
title: "Argo CD — 선언적 GitOps 지속 배포"
description: "Argo CD의 구성 요소(api-server·repo-server·application-controller), Application CRD 작성법, Sync Status와 Health Status의 차이, 자동 동기화·prune·self-heal 옵션, Sync Wave와 Hook을 이용한 배포 순서 제어, App of Apps 패턴까지 실전 중심으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["ArgoCD", "GitOps", "CD", "Application", "SyncWave", "배포자동화", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-gitops-intro/)에서 GitOps의 개념 — pull 기반 배포와 조정 루프 — 을 정리했다. 이번에는 그 모델을 구현한 도구 중 가장 널리 쓰이는 **Argo CD**를 직접 다뤄본다. Argo CD는 CNCF 졸업 프로젝트로, 직관적인 웹 UI 덕분에 GitOps 입문 장벽을 크게 낮춘 도구다. 설치부터 첫 Application 배포, 그리고 실무에서 반드시 만나는 동기화 옵션과 순서 제어까지 차례로 살펴본다.

## 설치와 첫 접속

```bash
# Argo CD 설치
kubectl create namespace argocd
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# 초기 admin 비밀번호 확인
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# UI 접속
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

`https://localhost:8080`에 admin으로 로그인하면 빈 대시보드가 보인다. 초기 비밀번호는 로그인 후 바로 바꾸고(`argocd account update-password`), 팀 도입 시에는 dex를 통한 SSO(GitHub, OIDC)로 전환하는 것이 정석이다.

## 내부 구조 — 세 개의 두뇌

Argo CD는 역할이 분리된 세 컴포넌트로 구성된다.

![Argo CD 구성 요소](/assets/posts/k8s-argocd-arch.svg)

- **repo-server**: Git을 clone하고 Helm/Kustomize를 실행해 "최종 매니페스트"를 렌더링한다. Argo CD가 Helm 차트든 Kustomize 오버레이든 순수 YAML이든 가리지 않는 이유가 이 컴포넌트다
- **application-controller**: 렌더링 결과(desired)와 클러스터 상태(actual)를 비교하고, 차이가 있으면 OutOfSync로 표시하거나 자동 동기화한다. 조정 루프의 본체다
- **api-server**: UI·CLI·API의 관문. RBAC과 SSO도 여기서 처리한다

Git 폴링 주기는 기본 3분이다. 더 빠른 반응이 필요하면 Git 저장소에 webhook을 걸어 push 즉시 동기화를 트리거할 수 있다.

## Application — "무엇을 어디에"의 선언

Argo CD의 핵심 CRD는 **Application**이다. "이 Git 경로의 매니페스트를, 이 클러스터의 이 네임스페이스에 배포하라"는 선언 한 장이다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-api-prod
  namespace: argocd
spec:
  project: default

  source:
    repoURL: https://github.com/example/k8s-config.git
    targetRevision: main
    path: apps/my-api/overlays/prod

  destination:
    server: https://kubernetes.default.svc   # 자기 자신
    namespace: prod

  syncPolicy:
    automated:
      prune: true       # Git에서 지워진 리소스 삭제
      selfHeal: true    # 드리프트 자동 복구
    syncOptions:
      - CreateNamespace=true
```

`syncPolicy.automated`가 없으면 OutOfSync 감지까지만 하고 사람이 UI/CLI에서 Sync 버튼을 눌러야 한다(수동 모드). 도입 초기엔 수동으로 시작해 diff를 눈으로 확인하는 습관을 들이고, 신뢰가 쌓이면 staging부터 자동으로 전환하는 경로를 권한다. `prune`과 `selfHeal`은 [지난 글](/posts/k8s-gitops-intro/)에서 말한 "Git이 진실"을 끝까지 밀어붙이는 옵션이다 — 켜는 순간 수동 kubectl 변경은 수 분 안에 되돌려진다.

## 두 가지 상태 축 읽기

UI에서 Application마다 두 가지 배지가 붙는다. 이 둘은 **독립적인 축**이라는 것이 중요하다.

![Application의 두 가지 상태 축과 Sync Wave](/assets/posts/k8s-argocd-sync.svg)

- **Sync Status**: 클러스터가 Git과 같은가? (`Synced` / `OutOfSync`)
- **Health Status**: 리소스가 잘 돌고 있는가? (`Healthy` / `Progressing` / `Degraded` / `Missing`)

"Synced인데 Degraded"는 흔한 조합이다 — Git대로 배포는 됐지만 새 이미지가 CrashLoop에 빠진 경우다. 반대로 "OutOfSync인데 Healthy"는 Git에 새 커밋이 들어왔는데 아직 동기화 전인 상태다. 장애 대응 때 이 두 축을 분리해서 읽으면 "배포 문제인가, 앱 문제인가"를 즉시 구분할 수 있다.

```bash
# CLI로 상태 확인과 수동 동기화
argocd app get my-api-prod
argocd app diff my-api-prod       # 적용 전 diff 확인
argocd app sync my-api-prod

# 긴급 롤백 — Git 히스토리의 이전 리비전으로
argocd app history my-api-prod
argocd app rollback my-api-prod 4
```

`rollback`은 비상용이다. 롤백 상태에서는 자동 동기화가 일시 중지되므로, 상황이 정리되면 반드시 Git에 revert 커밋을 넣어 진실 공급원을 다시 일치시켜야 한다.

## 배포 순서 제어 — Hook과 Sync Wave

리소스를 한꺼번에 apply하면 안 되는 경우가 있다. DB 마이그레이션이 끝나기 전에 새 버전 파드가 뜨면 안 되고, ConfigMap이 만들어지기 전에 그것을 참조하는 Deployment가 뜨면 안 된다. Argo CD는 두 가지 장치를 제공한다.

```yaml
# 1. Hook — sync 생애주기의 특정 시점에 실행
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: my-api:v1.4.2
          command: ["./migrate.sh"]
      restartPolicy: Never
```

```yaml
# 2. Sync Wave — 숫자가 작은 wave부터 순서대로
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "1"
```

PreSync 훅(마이그레이션)이 성공해야 본 동기화가 시작되고, wave 0(ConfigMap·Secret) → wave 1(Deployment·Service) 순으로 진행되며, 각 wave는 이전 wave의 리소스가 Healthy가 된 뒤에야 시작된다. PostSync 훅으로 스모크 테스트 Job을 돌려 배포 검증까지 파이프라인 안에 넣을 수 있다.

## App of Apps — 애플리케이션이 늘어나면

서비스가 30개가 되면 Application YAML 30장을 누가 관리할까? 답은 재귀다. **Application들을 배포하는 Application**을 만든다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/example/k8s-config.git
    targetRevision: main
    path: argocd/apps        # 이 폴더에 Application YAML들이 모여 있다
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated: { prune: true, selfHeal: true }
```

root 하나만 수동으로 만들면, 이후 새 서비스 온보딩은 "argocd/apps 폴더에 Application YAML 추가 후 머지"로 끝난다. 더 대규모(멀티 클러스터 × 멀티 환경 매트릭스)에서는 ApplicationSet 컨트롤러가 generator로 Application들을 찍어내는 방식으로 확장한다.

## 운영 팁 세 가지

- **무시 규칙 설정**: HPA가 관리하는 `spec.replicas`처럼 클러스터가 정당하게 바꾸는 필드는 `ignoreDifferences`로 비교에서 제외하라. 안 그러면 영원히 OutOfSync로 깜빡인다
- **Project로 경계 긋기**: AppProject로 "이 팀은 이 repo의 이 네임스페이스에만 배포 가능"을 강제할 수 있다. 멀티 테넌트 클러스터의 필수 장치다
- **Argo CD 자신도 GitOps로**: Argo CD 설치 매니페스트와 설정(ConfigMap)도 Git에 두고 Argo CD가 자기 자신을 관리하게 하라. "누가 Argo CD 설정을 바꿨지?"라는 질문이 사라진다

## 마무리

Argo CD는 GitOps의 조정 루프를 눈에 보이는 형태로 만들어준다 — Git과 클러스터의 diff, 동기화 상태, 리소스 트리가 UI 한 화면에 펼쳐진다. Application으로 선언하고, automated + prune + selfHeal로 신뢰를 위임하고, Wave와 Hook으로 순서를 통제하는 것이 운영의 뼈대다. 그런데 GitOps 도구가 Argo CD만 있는 것은 아니다. 다음 글에서는 UI 대신 Kubernetes 네이티브 CRD 조합으로 같은 문제를 푸는 다른 철학의 도구, **Flux**를 살펴보고 둘을 비교한다.

---

**지난 글:** [GitOps 입문 — Git을 단일 진실 공급원으로](/posts/k8s-gitops-intro/)

**다음 글:** [Flux — GitOps 툴킷으로 구축하는 자동 배포](/posts/k8s-flux/)

<br>
읽어주셔서 감사합니다. 😊
