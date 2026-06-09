---
title: "Operator 패턴 — 도메인 지식을 코드로"
description: "Kubernetes Operator 패턴의 핵심인 CRD + Controller 조합, Reconcile Loop, Level-Triggered vs Edge-Triggered 접근법, 실제 Operator 구현 사례(Database, Cert-Manager)를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Operator", "Controller", "Reconcile Loop", "CRD", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/k8s-finalizers/)에서 Finalizer를 통해 리소스 삭제 시 정리 작업을 보장하는 방법을 살펴봤다. 이번 글에서는 Kubernetes의 확장성을 극한까지 활용하는 **Operator 패턴**을 탐구한다. Operator는 단순한 코드가 아니라 **운영자의 도메인 지식을 코드로 캡슐화**한 것이다. 데이터베이스를 백업하고, 인증서를 갱신하고, 클러스터를 셀프힐링하는 이 모든 자동화의 중심에 Operator 패턴이 있다.

## Operator 패턴이란

2016년 CoreOS(현 Red Hat)가 처음 소개한 Operator 패턴은 **CRD(Custom Resource Definition) + Controller** 조합으로 Kubernetes 위에서 애플리케이션의 라이프사이클을 완전히 자동화하는 방식이다.

전통적인 운영자(Operator)가 하는 일을 생각해 보자. 데이터베이스 관리자는 마스터 장애 시 슬레이브를 프로모션하고, 정기적으로 백업을 실행하고, 클러스터 확장 시 샤딩을 조정한다. Operator 패턴은 이 **전문 지식을 소프트웨어로 인코딩**하여 Kubernetes가 자율적으로 이를 수행하게 만든다.

```yaml
# Operator가 처리하는 Custom Resource 예시
apiVersion: databases.example.com/v1
kind: PostgresCluster
metadata:
  name: prod-db
spec:
  replicas: 3
  version: "15"
  backup:
    schedule: "0 2 * * *"   # 매일 새벽 2시 백업
    retention: 7d
  resources:
    requests:
      memory: "2Gi"
      cpu: "1"
```

위 YAML 파일 하나로 3개의 PostgreSQL 파드, 서비스 디스커버리, 자동 백업 스케줄, 장애 조치(Failover) 설정이 모두 선언된다. 이것이 가능한 것은 Operator가 이 선언을 해석하고 실제 Kubernetes 리소스로 변환하기 때문이다.

## CRD: 새로운 API 리소스 정의

Operator의 첫 번째 구성 요소는 **CRD**다. CRD는 Kubernetes API를 확장하여 사용자 정의 리소스 타입을 추가한다. `kubectl get postgresclusters`처럼 기본 리소스와 동일하게 사용할 수 있게 된다.

```yaml
# CRD 정의 (일부)
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: postgresclusters.databases.example.com
spec:
  group: databases.example.com
  names:
    kind: PostgresCluster
    plural: postgresclusters
    singular: postgrescluster
    shortNames: ["pgc"]
  scope: Namespaced
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required: ["replicas", "version"]
              properties:
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 10
                version:
                  type: string
```

CRD가 등록되면 Kubernetes API Server가 해당 리소스의 CRUD 작업을 처리하고 etcd에 저장한다. 컨트롤러는 이 리소스를 감시하다가 변화가 생기면 행동한다.

## Controller와 Reconcile Loop

Operator의 두 번째 구성 요소는 **Controller**다. Controller는 끊임없이 실행되는 루프로, Custom Resource의 **Desired State**(사용자가 원하는 상태)와 **Current State**(현재 클러스터 상태)를 비교하고 차이를 해소한다. 이 과정을 **Reconciliation(조화)**이라 한다.

![Operator Reconcile Loop](/assets/posts/k8s-operators-pattern.svg)

```go
// Reconcile 함수의 기본 구조 (controller-runtime)
func (r *PostgresClusterReconciler) Reconcile(
    ctx context.Context, req ctrl.Request,
) (ctrl.Result, error) {
    log := log.FromContext(ctx)

    // 1. Desired State 읽기
    var cluster databasesv1.PostgresCluster
    if err := r.Get(ctx, req.NamespacedName, &cluster); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // 2. Current State 조회
    var existingSts appsv1.StatefulSet
    err := r.Get(ctx, types.NamespacedName{
        Name:      cluster.Name + "-sts",
        Namespace: cluster.Namespace,
    }, &existingSts)

    // 3. 차이 계산 및 조치
    if errors.IsNotFound(err) {
        // StatefulSet이 없으면 생성
        return ctrl.Result{}, r.createStatefulSet(ctx, &cluster)
    }

    // 레플리카 수 불일치 시 업데이트
    if *existingSts.Spec.Replicas != int32(cluster.Spec.Replicas) {
        log.Info("Updating replicas", "desired", cluster.Spec.Replicas)
        return ctrl.Result{}, r.updateStatefulSet(ctx, &cluster, &existingSts)
    }

    // 4. 상태 업데이트
    cluster.Status.ReadyReplicas = existingSts.Status.ReadyReplicas
    return ctrl.Result{}, r.Status().Update(ctx, &cluster)
}
```

Reconcile 함수의 반환값 `ctrl.Result`는 재큐 타이밍을 제어한다. `RequeueAfter: 30 * time.Second`처럼 설정하면 30초 후에 다시 Reconcile이 실행된다. 외부 상태를 주기적으로 확인해야 할 때 유용하다.

## Level-Triggered vs Edge-Triggered

Operator 설계에서 가장 중요한 철학적 선택은 **Level-Triggered** 방식을 채택하는 것이다.

### Edge-Triggered (이벤트 기반, 비권장)

이벤트 발생 시에만 반응한다. "Pod가 죽었다" 이벤트를 받아 Pod를 재생성한다. 문제는 이벤트가 유실되면 시스템이 비일관 상태에 머문다는 것이다.

### Level-Triggered (상태 기반, 권장)

**현재 상태 전체를 항상 읽고 Desired State와 비교**한다. 이벤트의 내용이 아니라 현재 상태만으로 무엇을 해야 하는지 결정한다. 이벤트가 유실되거나 컨트롤러가 재시작되어도 다음 Reconcile에서 올바른 상태를 찾아낸다.

```go
// Level-Triggered 방식의 핵심: 이벤트 내용을 믿지 않고 항상 현재 상태 조회
func (r *Reconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 이벤트가 "Pod 삭제됨"이든 "ConfigMap 수정됨"이든
    // 무조건 현재 상태를 읽는다
    current, err := r.getCurrentState(ctx, req)
    desired := r.computeDesiredState(current)
    return r.reconcileDiff(ctx, current, desired)
}
```

Level-Triggered 방식의 또 다른 이점은 **멱등성**이다. 같은 요청을 10번 실행해도 결과가 동일하다. 이는 분산 시스템의 신뢰성을 크게 높인다.

## 실제 Operator 구현 사례

현재 수백 개의 오픈소스 Operator가 OperatorHub.io에 등록되어 있다. 가장 널리 쓰이는 세 가지를 살펴보자.

![실제 Operator 사례](/assets/posts/k8s-operators-examples.svg)

### CloudNativePG (Database Operator)

PostgreSQL 클러스터를 Kubernetes 위에서 완전 자동화한다. `PostgresCluster` CRD 하나로 다음을 선언적으로 관리한다.

- Primary/Replica StatefulSet 자동 생성 및 관리
- Raft 기반 자동 Failover (Primary 장애 시 Replica 자동 승격)
- WAL(Write-Ahead Log) 기반 Point-in-Time Recovery
- 스케줄 기반 백업 (S3, GCS 등 외부 스토리지)

```bash
# CloudNativePG 설치
kubectl apply -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.22/releases/cnpg-1.22.0.yaml

# 3-노드 PostgreSQL 클러스터 생성
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: cluster-example
spec:
  instances: 3
  storage:
    size: 10Gi
EOF
```

### Cert-Manager

TLS 인증서의 발급, 갱신, 배포를 완전 자동화한다. `Certificate` CRD로 원하는 인증서를 선언하면 Operator가 ACME 프로토콜(Let's Encrypt)로 인증서를 발급하고 만료 30일 전 자동 갱신한다.

```yaml
# Cert-Manager Certificate 선언
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: my-tls-cert
  namespace: default
spec:
  secretName: my-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - my-app.example.com
    - www.my-app.example.com
  duration: 2160h      # 90일
  renewBefore: 720h    # 만료 30일 전 갱신
```

인증서 발급 흐름은 다음과 같다: `Certificate` 생성 → Cert-Manager가 `CertificateRequest` 생성 → ACME challenge 수행(HTTP-01 또는 DNS-01) → 인증서 발급 → `Secret`에 저장 → Ingress에 자동 주입.

### Prometheus Operator

모니터링 스택을 선언적으로 관리한다. `ServiceMonitor` CRD를 사용하면 특정 Service를 Prometheus 스크랩 대상으로 자동 등록할 수 있다. Grafana, Alertmanager까지 포함한 `kube-prometheus-stack` 헬름 차트가 널리 쓰인다.

```yaml
# ServiceMonitor: my-app의 /metrics 엔드포인트를 자동 스크랩
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```

## Operator 성숙도 모델

Operator Framework는 Operator의 능력 수준을 다음과 같이 정의한다.

| 레벨 | 능력 | 설명 |
|------|------|------|
| Level 1 | Basic Install | 앱 배포/설정 자동화 |
| Level 2 | Seamless Upgrades | 무중단 업그레이드 |
| Level 3 | Full Lifecycle | 백업, 복구, 실패 처리 |
| Level 4 | Deep Insights | 메트릭, 알림, 분석 |
| Level 5 | Auto Pilot | 자동 스케일링, 자동 튜닝 |

프로덕션에서 사용할 Operator는 최소 Level 3 이상이어야 한다. Level 1~2의 Operator는 초기 배포는 자동화하지만, 실제 운영 중 발생하는 장애와 업그레이드를 수동으로 처리해야 한다.

## Operator 개발 시 주의사항

Operator를 직접 개발할 때 반드시 지켜야 할 원칙들이 있다.

```go
// 1. 멱등성: 동일한 Reconcile을 여러 번 실행해도 안전해야 한다
func (r *Reconciler) ensureConfigMap(ctx context.Context, owner *v1.MyApp) error {
    cm := buildConfigMap(owner)
    // CreateOrUpdate: 없으면 생성, 있으면 업데이트 (멱등)
    _, err := controllerutil.CreateOrUpdate(ctx, r.Client, cm, func() error {
        cm.Data = buildConfigMapData(owner)
        return controllerutil.SetControllerReference(owner, cm, r.Scheme)
    })
    return err
}

// 2. 낙관적 잠금: 리소스 버전 충돌 처리
if errors.IsConflict(err) {
    return ctrl.Result{Requeue: true}, nil
}

// 3. 리소스 제한: Operator 자체도 requests/limits 설정
// 4. RBAC 최소 권한: 필요한 리소스만 watch/update 권한 부여
```

**레이트 리미팅**도 중요하다. `ctrl.Result{RequeueAfter: 5 * time.Second}` 같이 짧은 재큐 간격을 남용하면 API Server에 과부하를 줄 수 있다. 지수 백오프(exponential backoff)를 활용하자.

## 다음 단계: controller-runtime과 Operator SDK

Operator를 처음부터 개발하려면 두 가지 주요 도구가 있다.

- **controller-runtime**: Operator 개발을 위한 Go 라이브러리. `Manager`, `Reconciler`, `Client` 등의 추상화를 제공한다.
- **Operator SDK**: Operator Framework가 제공하는 CLI 도구. 코드 스캐폴딩, OLM(Operator Lifecycle Manager) 통합을 지원한다. Go, Ansible, Helm 기반 Operator를 지원한다.

다음 글에서는 controller-runtime과 Operator SDK를 사용하여 실제 Operator를 단계별로 구현하는 방법을 다룬다.

---

**지난 글:** [Finalizer — 리소스 삭제 전 정리 보장](/posts/k8s-finalizers/)

**다음 글:** [controller-runtime과 Operator SDK로 Operator 개발하기](/posts/k8s-controller-runtime-operator-sdk/)

<br>
읽어주셔서 감사합니다. 😊
