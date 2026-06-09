---
title: "controller-runtime과 Operator SDK로 Operator 개발하기"
description: "controller-runtime 라이브러리의 Manager·Reconciler·Client 구조, kubebuilder로 프로젝트 스캐폴딩, Operator SDK의 Go/Ansible/Helm 플러그인, 그리고 Reconcile 함수 구현 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "controller-runtime", "Operator SDK", "kubebuilder", "Go", "Operator 개발"]
featured: false
draft: false
---

[지난 글](/posts/k8s-operators/)에서 Operator 패턴의 개념과 CRD를 활용한 도메인 지식 표현 방법을 살펴봤다. 이번 글에서는 실제로 Operator를 개발할 때 사용하는 두 가지 핵심 도구인 **controller-runtime**과 **Operator SDK**를 깊이 파헤친다. "직접 Operator를 만들어보고 싶다"는 독자에게 꼭 필요한 내용을 담았다.

## controller-runtime이란?

**controller-runtime**(`sigs.k8s.io/controller-runtime`)은 쿠버네티스 SIG(Special Interest Group)가 관리하는 Go 라이브러리다. Operator 개발에 필요한 공통 패턴, 즉 API Server와의 통신, 리소스 캐싱, 이벤트 큐 처리, Reconcile 루프 실행 등을 모두 추상화해 제공한다.

kubebuilder와 Operator SDK 모두 controller-runtime을 내부적으로 사용한다. 따라서 controller-runtime을 이해하면 두 프레임워크 모두를 제대로 활용할 수 있다.

![controller-runtime 스택 구조](/assets/posts/k8s-controller-runtime-operator-sdk-stack.svg)

### Manager

`Manager`는 controller-runtime의 진입점이다. `ctrl.NewManager()`로 생성하며, 모든 컨트롤러가 공유하는 의존성(Cache, Client, Scheme)을 초기화하고 라이프사이클을 관리한다.

```go
mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
    Scheme:                 scheme,
    MetricsBindAddress:     ":8080",
    HealthProbeBindAddress: ":8081",
    LeaderElection:         true,
    LeaderElectionID:       "myapp.example.com",
})
```

`LeaderElection: true`를 설정하면 HA 환경에서 여러 Operator Pod가 뜨더라도 리더 하나만 Reconcile을 실행한다. 나머지는 대기 상태를 유지하다가 리더가 장애나면 선출을 통해 새 리더가 이어받는다.

**Cache**는 `SharedInformer` 기반의 로컬 오브젝트 저장소다. `client.Get()`이나 `client.List()`를 호출하면 API Server에 직접 질의하지 않고 이 캐시를 읽는다. 캐시는 Watch를 통해 항상 최신 상태를 유지한다.

**Client**는 쿠버네티스 리소스에 대한 CRUD 연산을 제공한다. 읽기(Get/List)는 캐시를 경유하고, 쓰기(Create/Update/Delete/Patch)는 API Server에 직접 요청한다.

**Scheme**은 Go 구조체 타입과 쿠버네티스 GVK(Group/Version/Kind)를 연결하는 매핑 테이블이다. CRD를 정의한 Go 타입을 Scheme에 등록해야 Client가 올바르게 직렬화/역직렬화할 수 있다.

### Controller와 WorkQueue

`Controller`는 Watch와 WorkQueue로 구성된다. 특정 리소스를 감시(Watch)하다가 이벤트가 발생하면 해당 리소스의 `namespace/name`을 WorkQueue에 넣는다. WorkQueue는 중복 제거와 Rate Limiting을 처리하므로, 같은 리소스에 이벤트가 폭발적으로 발생해도 Reconcile은 적절한 속도로만 호출된다.

```go
err = (&controllers.MyAppReconciler{
    Client: mgr.GetClient(),
    Scheme: mgr.GetScheme(),
}).SetupWithManager(mgr)

// SetupWithManager 내부
func (r *MyAppReconciler) SetupWithManager(mgr ctrl.Manager) error {
    return ctrl.NewControllerManagedBy(mgr).
        For(&myappv1.MyApp{}).          // 주 감시 대상
        Owns(&appsv1.Deployment{}).      // 소유한 자식 리소스
        Owns(&corev1.Service{}).
        WithOptions(controller.Options{
            MaxConcurrentReconciles: 3,  // 병렬 처리 수
        }).
        Complete(r)
}
```

`For()`는 Operator가 관리하는 주 CRD를 지정한다. `Owns()`는 이 Operator가 생성한 자식 리소스(Deployment, Service 등)를 감시한다. 자식이 변경되면 소유자(부모 CR)의 Reconcile이 자동으로 트리거된다.

## Reconcile 함수 구현 패턴

Reconcile 함수는 단 하나의 원칙을 따른다: **"현재 상태를 읽고, 원하는 상태와 비교하고, 차이를 해소하라."** 이 함수는 언제든 여러 번 호출될 수 있으므로 반드시 **멱등성(idempotency)**을 보장해야 한다.

![Reconcile 함수 흐름](/assets/posts/k8s-controller-runtime-operator-sdk-reconcile.svg)

### 표준 Reconcile 스켈레톤

```go
func (r *MyAppReconciler) Reconcile(
    ctx context.Context, req ctrl.Request,
) (ctrl.Result, error) {
    log := log.FromContext(ctx)

    // 1. 리소스 조회
    myapp := &myappv1.MyApp{}
    if err := r.Get(ctx, req.NamespacedName, myapp); err != nil {
        if errors.IsNotFound(err) {
            return ctrl.Result{}, nil // 이미 삭제됨
        }
        return ctrl.Result{}, err
    }

    // 2. 삭제 중 확인 (Finalizer 처리)
    if !myapp.DeletionTimestamp.IsZero() {
        return r.handleDeletion(ctx, myapp)
    }

    // 3. Finalizer 등록
    if !controllerutil.ContainsFinalizer(myapp, myFinalizer) {
        controllerutil.AddFinalizer(myapp, myFinalizer)
        return ctrl.Result{}, r.Update(ctx, myapp)
    }

    // 4. 비즈니스 로직: Deployment 생성/수정
    if err := r.reconcileDeployment(ctx, myapp); err != nil {
        return ctrl.Result{}, err
    }

    // 5. Status 업데이트
    myapp.Status.Phase = "Running"
    if err := r.Status().Update(ctx, myapp); err != nil {
        return ctrl.Result{}, err
    }

    // 6. 주기적 재조정 (선택)
    return ctrl.Result{RequeueAfter: 5 * time.Minute}, nil
}
```

### Requeue 전략

`ctrl.Result`의 반환값이 다음 동작을 결정한다:

| 반환값 | 동작 |
|--------|------|
| `Result{}` + `nil` | 완료, 다음 이벤트까지 대기 |
| `Result{Requeue: true}` + `nil` | 즉시 WorkQueue에 재등록 |
| `Result{RequeueAfter: D}` + `nil` | D 후 재등록 |
| `Result{}` + `err` | 에러 로그 + 지수 백오프로 재시도 |

에러를 반환하면 controller-runtime이 지수 백오프를 적용해 자동으로 재시도한다. 외부 API 호출이 실패했을 때 적합하다. `RequeueAfter`는 조건이 아직 충족되지 않아 잠시 후 다시 확인이 필요할 때 사용한다(예: 외부 DB가 아직 준비 안 됨).

### CreateOrUpdate 패턴

자식 리소스를 관리할 때는 `controllerutil.CreateOrUpdate()`를 활용하면 간결하다.

```go
func (r *MyAppReconciler) reconcileDeployment(
    ctx context.Context, myapp *myappv1.MyApp,
) error {
    deploy := &appsv1.Deployment{
        ObjectMeta: metav1.ObjectMeta{
            Name:      myapp.Name,
            Namespace: myapp.Namespace,
        },
    }
    _, err := controllerutil.CreateOrUpdate(ctx, r.Client, deploy, func() error {
        // OwnerReference 설정: CR 삭제 시 자식도 자동 삭제
        if err := controllerutil.SetControllerReference(
            myapp, deploy, r.Scheme); err != nil {
            return err
        }
        // 원하는 상태 정의
        deploy.Spec.Replicas = myapp.Spec.Replicas
        deploy.Spec.Template.Spec.Containers[0].Image = myapp.Spec.Image
        return nil
    })
    return err
}
```

## kubebuilder로 프로젝트 스캐폴딩

**kubebuilder**는 controller-runtime 기반의 Operator 개발 도구로, 보일러플레이트 코드를 자동 생성한다.

```bash
# 프로젝트 초기화
kubebuilder init --domain example.com --repo github.com/myorg/myapp-operator

# API (CRD + Controller) 생성
kubebuilder create api \
  --group apps \
  --version v1alpha1 \
  --kind MyApp \
  --resource --controller

# Webhook 생성
kubebuilder create webhook \
  --group apps \
  --version v1alpha1 \
  --kind MyApp \
  --defaulting --programmatic-validation
```

kubebuilder가 생성하는 구조:

```
myapp-operator/
├── api/v1alpha1/
│   ├── myapp_types.go      # CRD 타입 정의
│   └── zz_generated.deepcopy.go
├── config/
│   ├── crd/                # CRD YAML (controller-gen이 생성)
│   ├── rbac/               # Role/ClusterRole
│   └── manager/            # Deployment YAML
├── controllers/
│   ├── myapp_controller.go # Reconcile 로직 작성 위치
│   └── suite_test.go
└── main.go
```

`//+kubebuilder:object:root=true`같은 마커 주석을 타입에 달면 `make generate`로 DeepCopy 함수와 CRD YAML이 자동 생성된다.

```go
// api/v1alpha1/myapp_types.go

//+kubebuilder:object:root=true
//+kubebuilder:subresource:status
//+kubebuilder:printcolumn:name="Phase",type=string,JSONPath=`.status.phase`
//+kubebuilder:printcolumn:name="Replicas",type=integer,JSONPath=`.spec.replicas`
type MyApp struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`
    Spec   MyAppSpec   `json:"spec,omitempty"`
    Status MyAppStatus `json:"status,omitempty"`
}

type MyAppSpec struct {
    //+kubebuilder:validation:Minimum=1
    //+kubebuilder:validation:Maximum=10
    Replicas *int32 `json:"replicas"`
    Image    string `json:"image"`
}
```

`//+kubebuilder:printcolumn` 마커는 `kubectl get myapp`의 출력 컬럼을 정의한다. `//+kubebuilder:subresource:status`는 Status를 별도 서브리소스로 분리해 메인 리소스와 독립적으로 업데이트할 수 있게 한다.

## Operator SDK

**Operator SDK**는 Red Hat이 주도하는 Operator 개발 프레임워크다. kubebuilder를 기반으로 하면서 세 가지 플러그인을 추가로 제공한다.

### Go 플러그인

kubebuilder와 거의 동일한 Go 기반 Operator 개발 경험을 제공한다. `operator-sdk init`, `operator-sdk create api` 명령이 kubebuilder와 같은 구조를 생성한다. 추가로 Operator Lifecycle Manager(OLM) 통합과 번들 빌드 기능을 제공한다.

```bash
operator-sdk init --domain example.com \
  --repo github.com/myorg/myapp-operator

operator-sdk create api \
  --group apps --version v1alpha1 \
  --kind MyApp --resource --controller

# OLM 번들 생성
make bundle
operator-sdk bundle validate ./bundle
```

### Ansible 플러그인

Go를 모르는 운영팀도 Operator를 만들 수 있게 해준다. Ansible Role이나 Playbook을 Reconcile 로직으로 사용한다.

```bash
operator-sdk init --plugins ansible \
  --domain example.com

operator-sdk create api \
  --group apps --version v1alpha1 \
  --kind MyApp --generate-role
```

`watches.yaml`에서 CR 변경이 어떤 Ansible Role을 실행할지 매핑하고, `roles/myapp/tasks/main.yml`에 실제 로직을 작성한다.

### Helm 플러그인

기존 Helm Chart를 Operator로 래핑한다. Chart의 `values.yaml`이 CR의 `spec`에 매핑된다.

```bash
operator-sdk init --plugins helm \
  --domain example.com \
  --helm-chart ./charts/myapp
```

`watches.yaml`에서 CR `spec` 값을 Helm values로 전달한다. 기존 Helm Chart가 있다면 Operator 전환 비용이 거의 없다.

## Operator Lifecycle Manager(OLM)

Operator SDK로 만든 Operator를 프로덕션에 배포할 때는 OLM을 활용하는 것이 좋다. OLM은 Operator의 설치, 업그레이드, RBAC 관리를 자동화한다.

```bash
# OLM 설치
operator-sdk olm install

# OperatorHub에서 Operator 검색 후 설치
kubectl apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: myapp-operator
  namespace: operators
spec:
  channel: stable
  name: myapp-operator
  source: operatorhubio-catalog
  sourceNamespace: olm
EOF
```

## 테스트 전략

controller-runtime은 `envtest`를 제공한다. 실제 쿠버네티스 API Server를 임베드해 인테그레이션 테스트를 실행할 수 있다.

```go
// controllers/suite_test.go
var _ = BeforeSuite(func() {
    testEnv = &envtest.Environment{
        CRDDirectoryPaths: []string{
            filepath.Join("..", "config", "crd", "bases"),
        },
    }
    cfg, err = testEnv.Start()
    k8sClient, err = client.New(cfg, client.Options{Scheme: scheme.Scheme})
})

var _ = Describe("MyApp Controller", func() {
    It("should create a Deployment when MyApp is created", func() {
        myapp := &myappv1.MyApp{...}
        Expect(k8sClient.Create(ctx, myapp)).To(Succeed())
        
        deploy := &appsv1.Deployment{}
        Eventually(func() bool {
            err := k8sClient.Get(ctx, types.NamespacedName{
                Name: myapp.Name, Namespace: myapp.Namespace,
            }, deploy)
            return err == nil
        }, timeout, interval).Should(BeTrue())
    })
})
```

`envtest`는 실제 kubelet과 스케줄러 없이 API Server와 etcd만 띄워 빠른 테스트 사이클을 제공한다. Pod의 Running 상태 전환처럼 kubelet이 필요한 부분은 테스트에서 직접 모킹해야 한다.

## 정리

controller-runtime은 Operator 개발의 복잡성을 대폭 줄여주는 필수 라이브러리다. **Manager가 공유 의존성을 제공하고, Controller가 이벤트를 감시해 큐에 넣으면, Reconciler가 비즈니스 로직을 실행한다**는 세 계층 구조를 이해하면 Operator 코드가 어떻게 흘러가는지 명확히 보인다.

kubebuilder는 이 위에서 스캐폴딩과 코드 생성을 담당하고, Operator SDK는 Go뿐 아니라 Ansible·Helm까지 지원해 더 넓은 사용자층을 포괄한다. 어떤 도구를 쓰든 결국 핵심은 멱등성 있는 Reconcile 함수를 올바르게 구현하는 것이다.

---

**지난 글:** [Operator 패턴 — 도메인 지식을 코드로](/posts/k8s-operators/)

**다음 글:** [Admission Webhook — 클러스터 진입 관문](/posts/k8s-admission-webhooks/)

<br>
읽어주셔서 감사합니다. 😊
