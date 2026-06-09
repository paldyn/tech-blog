---
title: "API Aggregation Layer — 쿠버네티스 API 확장 제2부"
description: "API Aggregation Layer로 kube-apiserver에 외부 API 서버를 등록하는 방법, APIService 리소스, 인증/TLS 처리, metrics-server와 같은 실제 구현 사례를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "API Aggregation", "APIService", "확장 API 서버", "metrics-server"]
featured: false
draft: false
---

[지난 글](/posts/k8s-crd-deep-dive/)에서 CRD의 스키마 검증, 버전 관리, Conversion Webhook까지 살펴봤다. 이번 글에서는 쿠버네티스 API 확장의 또 다른 축인 **API Aggregation Layer**를 다룬다. CRD가 새로운 리소스 타입을 선언적으로 등록하는 방법이라면, API Aggregation은 완전히 독립적인 API 서버를 쿠버네티스 API 경로 아래에 통합하는 방법이다. `kubectl top` 명령이 동작하는 원리가 바로 여기에 있다.

## API Aggregation이란

쿠버네티스 API는 단일 서버가 아니다. `kube-apiserver`는 일종의 **API 게이트웨이** 역할을 하며, 일부 API 경로는 외부 API 서버로 **프록시(proxy)**된다. 이 메커니즘을 **API Aggregation Layer**라고 한다.

CRD와 API Aggregation의 차이는 명확하다.

| 구분 | CRD | API Aggregation |
|---|---|---|
| 저장소 | kube-apiserver의 etcd | 확장 서버가 자체 관리 |
| 구현 복잡도 | 낮음 | 높음 (독립 서버 필요) |
| 사용 사례 | Operator, 도메인 리소스 | metrics API, 자체 스토리지 |
| 예시 | Prometheus Operator | metrics-server |

확장 API 서버가 필요한 경우는 주로 다음과 같다.

- 쿠버네티스 etcd 외부에 데이터를 저장해야 할 때 (예: 시계열 DB)
- 리소스 목록 조회가 실시간 집계를 필요로 할 때
- 기존 REST 서버를 쿠버네티스 API 경로에 통합하고 싶을 때

![API Aggregation Layer 아키텍처](/assets/posts/k8s-api-aggregation-architecture.svg)

## APIService 리소스

API Aggregation의 핵심은 `APIService` 리소스다. 이 리소스를 등록하면 `kube-apiserver`가 해당 API 그룹·버전에 대한 요청을 지정된 서비스로 프록시하기 시작한다.

```yaml
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1beta1.metrics.k8s.io
spec:
  group: metrics.k8s.io
  version: v1beta1
  service:
    namespace: kube-system
    name: metrics-server
    port: 443
  caBundle: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0t...
  groupPriorityMinimum: 100
  versionPriority: 100
```

`name` 필드의 형식은 `{version}.{group}`이다. 위 예시에서 `v1beta1.metrics.k8s.io`를 등록하면 `/apis/metrics.k8s.io/v1beta1/` 경로의 모든 요청이 `kube-system` 네임스페이스의 `metrics-server` 서비스 443 포트로 프록시된다.

### 내장 APIService

흥미롭게도 쿠버네티스 자체 API도 동일한 메커니즘으로 등록돼 있다. `kubectl get apiservice`를 실행하면 `v1.apps`, `v1.batch` 같은 내장 API도 볼 수 있다. 이들은 서비스 대신 `kube-apiserver` 자체가 처리한다.

```bash
kubectl get apiservice
# NAME                                   SERVICE                      AVAILABLE   AGE
# v1.                                    Local                        True        30d
# v1.apps                                Local                        True        30d
# v1beta1.metrics.k8s.io                 kube-system/metrics-server   True        30d
```

`SERVICE` 컬럼이 `Local`이면 kube-apiserver 자체 처리, 서비스 이름이 있으면 외부 서버로 프록시된다는 의미다.

## 요청 흐름과 인증 처리

API Aggregation에서 가장 중요하고 복잡한 부분은 **인증 정보의 전달**이다.

![API Aggregation 요청 라우팅과 TLS/인증 처리](/assets/posts/k8s-api-aggregation-flow.svg)

### 요청 흐름 상세

1. 클라이언트(`kubectl`)가 TLS로 `kube-apiserver`에 요청을 보낸다. Bearer 토큰 또는 클라이언트 인증서가 포함된다.
2. `kube-apiserver`가 요청을 먼저 인증한다. 사용자가 누구인지 확인한다.
3. API 그룹이 외부 APIService에 등록돼 있으면 Aggregation Layer가 요청을 가로채서 프록시를 준비한다.
4. Aggregation Layer는 원본 클라이언트의 인증 정보를 HTTP 헤더로 변환해 확장 서버에 전달한다.
5. 확장 서버는 헤더를 신뢰하고 RBAC 결정을 내린 후 응답한다.

### Impersonation 헤더

확장 서버로 전달되는 헤더는 다음과 같다.

```
X-Remote-User: alice
X-Remote-Group: system:authenticated
X-Remote-Group: team-a
X-Remote-Extra-scopes: openid
```

확장 서버는 이 헤더를 신뢰하는 대신, 요청이 정말로 `kube-apiserver`에서 왔는지 확인해야 한다. 이를 위해 **클라이언트 인증서 검증**을 사용한다. kube-apiserver가 확장 서버에 요청할 때 사용하는 클라이언트 인증서의 CA를 확장 서버에 미리 등록해 두면, 헤더를 가진 요청이 신뢰할 수 있는 kube-apiserver에서 온 것임을 확인할 수 있다.

### TLS 요구사항

APIService의 `caBundle`은 확장 서버의 TLS 인증서를 서명한 CA를 base64로 인코딩한 값이다. `kube-apiserver`는 이 CA로 확장 서버의 인증서를 검증한다.

```bash
# CA 인증서를 base64로 인코딩
kubectl get secret my-cert-secret -o jsonpath='{.data.ca\.crt}'

# 또는 cert-manager Certificate 리소스 활용
kubectl get certificate my-ext-tls -o jsonpath='{.status.conditions}'
```

개발 환경이라면 `insecureSkipTLSVerify: true`를 일시적으로 사용할 수 있지만, 프로덕션에서는 반드시 유효한 `caBundle`을 설정해야 한다.

## metrics-server 구현 분석

`metrics-server`는 API Aggregation의 가장 대표적인 실제 구현체다. `kubectl top pods`, `kubectl top nodes`, HPA의 CPU/메모리 메트릭이 모두 metrics-server가 제공하는 `metrics.k8s.io/v1beta1` API를 통해 동작한다.

### 설치와 동작 원리

```bash
# metrics-server 설치
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 설치 확인
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl top nodes
kubectl top pods -n kube-system
```

metrics-server가 설치되면 다음 일이 일어난다.

1. `kube-system` 네임스페이스에 metrics-server Deployment가 생성된다.
2. `v1beta1.metrics.k8s.io` APIService가 등록된다.
3. metrics-server 파드는 각 노드의 kubelet `/stats/summary` API를 폴링해 CPU, 메모리 사용량을 수집한다.
4. `kubectl top` 명령이 실행되면 kube-apiserver가 요청을 metrics-server로 프록시한다.
5. metrics-server가 수집한 최신 메트릭을 JSON으로 반환한다.

### metrics-server의 API 응답 구조

```json
{
  "kind": "PodMetrics",
  "apiVersion": "metrics.k8s.io/v1beta1",
  "metadata": {
    "name": "my-pod",
    "namespace": "default"
  },
  "containers": [
    {
      "name": "app",
      "usage": {
        "cpu": "125m",
        "memory": "64Mi"
      }
    }
  ]
}
```

이 데이터는 etcd에 저장되지 않는다. metrics-server가 인메모리로 유지하며 주기적으로 갱신한다. 이것이 API Aggregation이 CRD보다 유리한 사례 중 하나다.

## 확장 API 서버 직접 구현

직접 확장 API 서버를 구현할 때는 `k8s.io/apiserver` 라이브러리를 활용하는 것을 권장한다. 이 라이브러리는 인증, RBAC, 버전 변환, watch 메커니즘 등 API 서버에 필요한 대부분의 기능을 내장하고 있다.

```go
// 확장 API 서버 최소 구성 (Go)
import (
    genericapiserver "k8s.io/apiserver/pkg/server"
    "k8s.io/apiserver/pkg/registry/rest"
)

type DatabaseStorage struct {
    // 자체 저장소 구현
}

func (s *DatabaseStorage) Get(
    ctx context.Context,
    name string,
    opts *metav1.GetOptions,
) (runtime.Object, error) {
    // 커스텀 저장소에서 조회
    return s.backend.Get(name), nil
}
```

`apiserver-builder` 도구를 사용하면 boilerplate 코드를 자동 생성할 수 있다.

```bash
# apiserver-builder 초기화
apiserver-boot init repo --domain example.com
apiserver-boot create group version resource \
  --group apps --version v1alpha1 --kind Database

# 빌드 및 배포
apiserver-boot build executables
apiserver-boot run in-cluster
```

### 디버깅과 모니터링

```bash
# APIService 상태 확인
kubectl describe apiservice v1beta1.metrics.k8s.io

# 확장 서버 로그 확인
kubectl logs -n kube-system -l app=metrics-server

# kube-apiserver 감사 로그에서 프록시 요청 확인
# /var/log/kubernetes/audit.log 에서 requestURI 필터링
```

`kubectl describe apiservice`의 출력에서 `Conditions: Available=True`가 보이지 않는다면 다음을 확인한다.

1. 서비스가 존재하고 포트 443이 열려 있는지
2. `caBundle`이 올바른 CA 인증서를 base64 인코딩한 값인지
3. 확장 서버의 서버 인증서가 해당 CA로 서명됐는지
4. 확장 서버가 `/apis/{group}/{version}` 경로에 올바른 APIGroupDiscovery를 반환하는지

## CRD vs API Aggregation 선택 가이드

운영 팀에서 가장 자주 묻는 질문 중 하나가 "언제 CRD를 쓰고 언제 API Aggregation을 써야 하나요?"다.

다음 기준으로 판단한다.

- **CRD를 선택해야 할 때**: 도메인 로직을 선언적 리소스로 표현하고 싶을 때, etcd에 저장해도 무방한 리소스일 때, 구현 복잡도를 낮추고 싶을 때. 대부분의 Operator 패턴은 CRD로 충분하다.
- **API Aggregation을 선택해야 할 때**: 실시간 집계 데이터를 API로 제공할 때, 자체 스토리지(시계열 DB, 외부 시스템)가 필요할 때, 기존 REST API를 쿠버네티스 API 경로에 통합할 때.

실제로 많은 프로젝트가 두 방법을 조합해서 사용한다. 예를 들어 Prometheus Operator는 CRD로 모니터링 설정을 선언하고, Thanos는 API Aggregation으로 장기 저장 메트릭 API를 제공한다.

---

**지난 글:** [CRD 심화 — 검증·버전 관리·Conversion Webhook](/posts/k8s-crd-deep-dive/)

**다음 글:** [Finalizer — 리소스 삭제 전 정리 보장](/posts/k8s-finalizers/)

<br>
읽어주셔서 감사합니다. 😊
