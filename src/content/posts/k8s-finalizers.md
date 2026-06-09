---
title: "Finalizer — 리소스 삭제 전 정리 보장"
description: "Kubernetes Finalizer의 동작 원리, deletionTimestamp와 graceful deletion 흐름, Owner Reference와 결합한 종속 리소스 정리 패턴, 그리고 Finalizer 남용 시 발생하는 stuck deletion 해결법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Finalizer", "Garbage Collection", "Owner Reference", "리소스 삭제"]
featured: false
draft: false
---

[지난 글](/posts/k8s-api-aggregation/)에서 API Aggregation Layer를 통해 Kubernetes API를 확장하는 방법을 살펴봤다. 이번 글에서는 리소스를 **안전하게 삭제**하기 위한 메커니즘, 바로 **Finalizer**를 집중적으로 다룬다. Finalizer는 단순해 보이지만, 이해하지 못하고 사용하면 오브젝트가 영영 삭제되지 않는 "stuck deletion" 문제를 유발하는 양날의 검이다.

## Finalizer란 무엇인가

Kubernetes에서 오브젝트를 `kubectl delete`로 삭제하면 즉시 사라지지 않는 경우가 있다. 그 이유는 오브젝트의 `metadata.finalizers` 필드에 **Finalizer**가 등록되어 있기 때문이다.

Finalizer는 오브젝트가 etcd에서 완전히 제거되기 전에 **사전 정리 작업(pre-delete hook)** 을 실행하도록 보장하는 문자열 목록이다. 삭제 요청이 들어와도 이 목록이 비어있지 않으면 Kubernetes는 오브젝트를 제거하지 않는다.

```yaml
# Finalizer가 등록된 오브젝트 예시
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
  namespace: default
  finalizers:
    - example.com/cleanup        # 커스텀 Finalizer
    - kubernetes.io/pvc-protection  # 빌트인 Finalizer 예시
```

빌트인 Finalizer의 대표적인 예는 `kubernetes.io/pvc-protection`이다. PVC가 Pod에 마운트된 상태에서 PVC를 삭제하려 하면, 이 Finalizer가 걸려 있어 Pod가 종료될 때까지 실제 삭제가 지연된다. 데이터 손실을 방지하기 위한 안전장치다.

## deletionTimestamp와 Terminating 상태

Finalizer가 등록된 오브젝트에 DELETE 요청이 오면 Kubernetes API Server는 다음 두 가지를 수행한다.

1. `metadata.deletionTimestamp` 필드에 현재 타임스탬프를 기록한다.
2. 오브젝트를 **Terminating** 상태로 전환한다.

이 시점부터 오브젝트는 API에서 여전히 조회되지만, 더 이상 수정은 제한된다(Finalizer 제거와 status 업데이트만 허용). 실제로 etcd에서 제거되는 것은 `metadata.finalizers` 목록이 완전히 비워진 이후다.

![Finalizer 오브젝트 삭제 라이프사이클](/assets/posts/k8s-finalizers-lifecycle.svg)

```bash
# Terminating 상태 확인
kubectl get configmap my-config -o yaml | grep -E "finalizers|deletionTimestamp"
# metadata.deletionTimestamp: "2026-06-10T10:00:00Z"
# metadata.finalizers:
#   - example.com/cleanup

# 오브젝트가 삭제 대기 중인지 확인
kubectl get configmap my-config -o jsonpath='{.metadata.deletionTimestamp}'
```

`deletionTimestamp`가 설정된 오브젝트는 **Read-Only에 가까운 상태**다. 새 Finalizer를 추가하려 하면 admission webhook이 거부한다. 오직 기존 Finalizer를 제거하는 PATCH만 허용된다.

## 컨트롤러가 Finalizer를 처리하는 방법

Finalizer는 혼자서는 아무 일도 하지 않는다. 실제 정리 작업을 실행하고 Finalizer를 제거하는 것은 **컨트롤러**의 책임이다. 컨트롤러는 Reconcile 루프에서 `deletionTimestamp`가 설정된 오브젝트를 감지하면 정리 로직을 실행하고, 완료되면 `metadata.finalizers`에서 자신의 항목을 제거한다.

```go
// controller-runtime 기반 Reconcile 함수 예시 (Go)
func (r *MyResourceReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var myResource myv1.MyResource
    if err := r.Get(ctx, req.NamespacedName, &myResource); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    finalizerName := "cleanup.example.com"

    // 삭제 중인지 확인
    if !myResource.DeletionTimestamp.IsZero() {
        if controllerutil.ContainsFinalizer(&myResource, finalizerName) {
            // 정리 로직 실행
            if err := r.cleanupExternalResources(ctx, &myResource); err != nil {
                return ctrl.Result{}, err
            }
            // Finalizer 제거
            controllerutil.RemoveFinalizer(&myResource, finalizerName)
            if err := r.Update(ctx, &myResource); err != nil {
                return ctrl.Result{}, err
            }
        }
        return ctrl.Result{}, nil
    }

    // 정상 상태: Finalizer가 없으면 추가
    if !controllerutil.ContainsFinalizer(&myResource, finalizerName) {
        controllerutil.AddFinalizer(&myResource, finalizerName)
        if err := r.Update(ctx, &myResource); err != nil {
            return ctrl.Result{}, err
        }
    }

    // 정상 Reconcile 로직
    return r.reconcileNormal(ctx, &myResource)
}
```

핵심은 **멱등성(idempotency)** 이다. 정리 로직은 여러 번 호출되어도 안전해야 한다. 컨트롤러가 재시작되거나 네트워크 오류로 Reconcile이 재호출될 수 있기 때문이다.

## Owner Reference와 Finalizer의 결합 패턴

Finalizer는 단독으로 쓰이기보다 **Owner Reference와 함께** 사용할 때 진가를 발휘한다. 부모 리소스에 Finalizer를 걸어두고, 컨트롤러는 부모가 Terminating 상태가 되면 자식 리소스들을 순서대로 정리한 후 Finalizer를 제거한다. 이를 통해 GC(Garbage Collector)의 기본 연쇄 삭제만으로는 보장할 수 없는 **정리 순서와 외부 리소스 정리**를 제어할 수 있다.

![Owner Reference + Finalizer 패턴](/assets/posts/k8s-finalizers-pattern.svg)

예를 들어 커스텀 `Application` CRD가 외부 클라우드 로드밸런서와 DNS 레코드를 관리한다고 하자. 단순 Owner Reference만으로는 Kubernetes 내부 오브젝트 삭제는 처리되지만, 외부 클라우드 리소스는 남는다. Finalizer를 사용하면 이 외부 리소스까지 정리하고 나서야 오브젝트가 제거된다.

```yaml
# 부모 오브젝트에 Finalizer 등록 예시
apiVersion: myapp.example.com/v1
kind: Application
metadata:
  name: my-app
  finalizers:
    - cleanup.myapp.example.com  # 외부 리소스 정리 담당
spec:
  loadBalancer:
    enabled: true
  dns:
    hostname: my-app.example.com
```

## 복수 Finalizer와 삭제 순서

한 오브젝트에 여러 Finalizer가 등록될 수 있다. Kubernetes는 각 Finalizer를 독립적으로 처리하며, **모든 Finalizer가 제거되어야** 오브젝트를 삭제한다. 그러나 Finalizer 간 실행 순서는 보장되지 않는다. 순서가 중요하다면 단일 Finalizer 아래에서 컨트롤러가 직접 순서를 제어해야 한다.

```bash
# 복수 Finalizer 확인
kubectl get pod my-pod -o jsonpath='{.metadata.finalizers[*]}'
# example.com/network-cleanup example.com/storage-cleanup

# 특정 Finalizer만 제거 (컨트롤러가 해야 할 일, 수동 조치 시)
kubectl patch pod my-pod --type=json \
  -p='[{"op":"remove","path":"/metadata/finalizers/0"}]'
```

## Stuck Deletion — Finalizer로 인한 삭제 불가 문제

Finalizer의 가장 큰 위험은 **컨트롤러가 없거나 죽어있을 때** Finalizer를 처리하는 주체가 사라져 오브젝트가 영구히 Terminating 상태에 머무는 것이다. 이를 stuck deletion이라 한다.

### 진단

```bash
# Terminating 상태로 오래 머무는 오브젝트 찾기
kubectl get namespace --field-selector status.phase=Terminating
kubectl get all --all-namespaces | grep Terminating

# Finalizer 내용 확인
kubectl get namespace stuck-ns -o jsonpath='{.metadata.finalizers}'
# ["kubernetes"] 또는 사라지지 않는 커스텀 Finalizer
```

### 해결책: Finalizer 강제 제거

컨트롤러 없이 Finalizer를 강제로 제거하는 방법이다. **주의: 이 방법은 외부 리소스 정리가 완전히 생략될 수 있으므로 반드시 외부 리소스 상태를 수동으로 확인한 후 실행해야 한다.**

```bash
# Namespace의 Finalizer 제거 (stuck namespace 해결)
kubectl patch namespace stuck-ns \
  -p '{"metadata":{"finalizers":[]}}' \
  --type=merge

# 또는 kubectl edit으로 직접 수정
kubectl edit namespace stuck-ns
# finalizers: [] 로 수정 후 저장

# 리소스가 완전히 삭제됐는지 확인
kubectl get namespace stuck-ns
# Error from server (NotFound): namespaces "stuck-ns" not found
```

### 예방 전략

1. **컨트롤러 안정성 확보**: Finalizer를 사용하는 컨트롤러는 고가용성(HA) 배포를 권장한다.
2. **타임아웃 로직 추가**: 정리 작업이 일정 시간 내에 완료되지 않으면 에러를 반환하고 재큐한다.
3. **Finalizer 최소화**: 꼭 필요한 경우에만 사용하고, 정리 로직이 단순할 경우 Owner Reference GC로 대체를 검토한다.
4. **모니터링**: Terminating 상태의 오브젝트 수를 메트릭으로 수집하고 알림을 설정한다.

## 빌트인 Finalizer 사례 정리

Kubernetes가 기본으로 제공하는 Finalizer들도 있다.

| Finalizer | 용도 |
|-----------|------|
| `kubernetes.io/pvc-protection` | Pod에 마운트된 PVC 보호 |
| `kubernetes.io/pv-protection` | PV 데이터 보호 |
| `foregroundDeletion` | Foreground cascade 삭제 시 |
| `orphan` | Orphan cascade 삭제 시 |

```bash
# PVC에 걸린 protection Finalizer 확인
kubectl get pvc my-pvc -o jsonpath='{.metadata.finalizers}'
# ["kubernetes.io/pvc-protection"]

# Pod가 살아있는 동안 PVC 삭제 시도 시 Terminating 상태 유지
kubectl delete pvc my-pvc
# persistentvolumeclaim "my-pvc" deleted (but not removed until pod stops)
```

## Finalizer vs PreStop Hook

Finalizer와 Pod의 `lifecycle.preStop` 훅은 비슷해 보이지만 목적이 다르다.

- **PreStop Hook**: Pod 내 컨테이너 종료 직전 실행. 프로세스가 graceful하게 종료하도록 돕는다.
- **Finalizer**: 오브젝트 레벨의 정리. 컨테이너와 무관한 Kubernetes 리소스 또는 외부 시스템 정리에 사용된다.

두 메커니즘은 상호 보완적이며, 완전한 graceful shutdown 구현에는 종종 함께 사용된다.

---

**지난 글:** [API Aggregation Layer — 쿠버네티스 API 확장 제2부](/posts/k8s-api-aggregation/)

**다음 글:** [Operator 패턴 — 도메인 지식을 코드로](/posts/k8s-operators/)

<br>
읽어주셔서 감사합니다. 😊
