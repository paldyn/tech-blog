---
title: "Argo Rollouts — 카나리·블루그린 배포 자동화"
description: "Deployment를 대체하는 Rollout CRD의 구조와 컨트롤러 동작, canary steps(setWeight·pause·analysis)로 단계를 선언하는 방법, AnalysisTemplate과 메트릭 공급자를 이용한 자동 분석·롤백, 트래픽 라우터 연동과 블루-그린 전략까지 실전 구성을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["ArgoRollouts", "카나리", "블루그린", "AnalysisTemplate", "프로그레시브딜리버리", "CD", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-progressive-delivery/)에서 프로그레시브 딜리버리의 개념 — 카나리, 블루-그린, 그리고 메트릭 기반 분석 게이트 — 을 살펴봤다. 그런데 트래픽 분배, 메트릭 조회, 단계 진행, 자동 롤백을 직접 엮으려면 일이 만만치 않다. **Argo Rollouts**는 이 모든 것을 Kubernetes 네이티브 CRD로 선언형으로 풀어주는 컨트롤러다. Deployment를 거의 그대로 대체하면서, 그 위에 단계적 노출과 자동 분석을 얹는다.

## Rollout — Deployment를 대체하는 CRD

Argo Rollouts의 중심은 `Rollout`이라는 CRD다. 작성법이 Deployment와 거의 같다. `replicas`, `selector`, `template`이 그대로 있고, 차이는 `strategy` 아래에 `canary` 또는 `blueGreen`을 선언한다는 점뿐이다. 컨트롤러는 이 strategy를 읽고, 내부적으로 stable과 canary 두 개의 ReplicaSet을 만들어 가중치를 조절하며 단계를 진행한다.

![Argo Rollouts — 구성 요소](/assets/posts/k8s-argo-rollouts-architecture.svg)

그림처럼 Rollouts는 네 가지가 맞물려 동작한다. **Rollout CRD**가 무엇을 어떻게 배포할지 선언하고, **컨트롤러**가 단계를 진행하며, **AnalysisRun**이 메트릭 공급자(Prometheus 등)에 쿼리해 건강 상태를 판정하고, **트래픽 라우터**(Istio, NGINX, ALB, Gateway API 등)가 실제 트래픽 비율을 조정한다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-api
spec:
  replicas: 5
  selector:
    matchLabels: { app: my-api }
  template:               # Deployment의 Pod 템플릿과 동일
    metadata:
      labels: { app: my-api }
    spec:
      containers:
        - name: api
          image: my-api:v2
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
```

기존 Deployment에서 마이그레이션할 때는 `kind`를 `Rollout`으로 바꾸고 `strategy`만 추가하면 된다(`workloadRef`로 기존 Deployment를 참조하는 방식도 있다).

## canary steps — 배포 시나리오를 선언하다

카나리의 진행 시나리오는 `strategy.canary.steps` 리스트로 선언한다. 컨트롤러는 이 리스트를 위에서 아래로 순서대로 실행한다. 핵심 step은 세 가지다.

- **setWeight**: 카나리로 보낼 트래픽 비율(%)을 설정한다
- **pause**: 다음 단계로 넘어가기 전 대기한다. `duration`을 주면 그 시간만큼 자동 대기하고, `{}`만 주면 사람이 `promote` 할 때까지 무기한 멈춘다
- **analysis**: AnalysisTemplate을 실행해 메트릭으로 자동 판정한다

![canary steps — 선언한 순서대로 진행](/assets/posts/k8s-argo-rollouts-canary-steps.svg)

`pause: {}`(무기한 대기)와 `analysis`(자동 판정)를 어떻게 섞느냐가 운영 스타일을 결정한다. 완전 자동화를 원하면 pause 대신 analysis로 메트릭이 통과할 때까지 두고, 사람의 최종 확인을 끼우고 싶으면 중요한 단계 앞에 `pause: {}`를 넣는다.

## AnalysisTemplate — 자동 분석의 정의

분석 게이트의 기준은 `AnalysisTemplate`(또는 클러스터 범위의 `ClusterAnalysisTemplate`)으로 따로 정의한다. 메트릭 공급자에 쿼리를 던지고, 결과가 `successCondition`을 만족하는지 본다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate
spec:
  metrics:
    - name: error-rate
      interval: 1m
      count: 5                 # 5회 측정
      successCondition: result < 0.01   # 에러율 1% 미만
      failureLimit: 2          # 2회 실패 시 abort
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{job="my-api",code=~"5.."}[2m]))
            / sum(rate(http_requests_total{job="my-api"}[2m]))
```

`failureLimit`을 넘기면 AnalysisRun은 실패로 판정되고, Rollout은 자동으로 abort — 즉 트래픽을 stable로 되돌리고 카나리 ReplicaSet을 축소한다. 사람이 대시보드를 지키고 있지 않아도, 메트릭이 나빠지면 스스로 롤백한다는 점이 핵심이다.

## 트래픽 라우터와 블루-그린

`setWeight: 10`이 실제로 10%를 만들려면 트래픽 라우터 연동이 필요하다. 연동하지 않으면 Rollouts는 replica 개수 비율로 근사한다(예: 10개 중 1개). 정밀한 비율을 원하면 `trafficRouting`에 사용 중인 메시/인그레스를 지정한다.

블루-그린은 더 단순하다. 새 버전을 미리 전부 띄우고(`previewService`로 사전 검증 가능), 준비되면 활성 서비스(`activeService`)가 가리키는 대상을 한 번에 전환한다.

```yaml
strategy:
  blueGreen:
    activeService: my-api-active     # 운영 트래픽
    previewService: my-api-preview   # 사전 검증용
    autoPromotionEnabled: false      # 수동 승급(promote)
```

`autoPromotionEnabled: false`로 두면 새 버전이 준비돼도 자동 전환하지 않고, `kubectl argo rollouts promote`로 사람이 확인한 뒤 전환한다.

## 운영 — kubectl 플러그인과 대시보드

Rollouts는 전용 kubectl 플러그인을 제공한다. 진행 상황을 실시간으로 보고, 수동으로 승급하거나 중단할 수 있다.

```bash
# 진행 상황 실시간 관찰
kubectl argo rollouts get rollout my-api --watch

# 다음 단계로 수동 승급(pause:{} 해제)
kubectl argo rollouts promote my-api

# 문제 발생 시 즉시 중단·롤백
kubectl argo rollouts abort my-api

# 웹 대시보드
kubectl argo rollouts dashboard
```

## 정리 — 그리고 다음

Argo Rollouts는 "위험을 점진적으로 흘려보낸다"는 프로그레시브 딜리버리의 철학을 선언형 CRD로 구현한다. Deployment와 거의 같은 매니페스트에 `strategy.canary.steps`로 시나리오를 적고, AnalysisTemplate으로 메트릭 게이트를 정의하면, 컨트롤러가 가중치 조정·분석·승급·롤백을 자동으로 조율한다. 사람은 중요한 순간에만 promote로 개입하면 된다.

여기까지가 애플리케이션을 안전하게 내보내는 이야기였다. 이제 시선을 클러스터 자체의 운영으로 옮긴다. 애플리케이션이 아무리 잘 배포돼도, 클러스터의 두뇌인 etcd가 망가지면 모든 것이 사라진다. 다음 글에서는 클러스터 상태를 지키는 마지막 보루, **etcd 백업과 복구**를 다룬다.

---

**지난 글:** [프로그레시브 딜리버리 — 위험을 점진적으로 흘려보내는 배포](/posts/k8s-progressive-delivery/)

**다음 글:** [etcd 백업과 복구 — 클러스터 상태를 지키는 마지막 보루](/posts/k8s-etcd-backup-restore/)

<br>
읽어주셔서 감사합니다. 😊
