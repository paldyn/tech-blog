---
title: "멀티 테넌시 — 하나의 클러스터를 안전하게 나눠 쓰기"
description: "여러 팀·프로젝트가 하나의 클러스터를 공유하는 멀티 테넌시의 모델(네임스페이스 분리·가상 클러스터·테넌트별 클러스터)을 격리 강도와 비용의 저울로 비교하고, 소프트 멀티테넌시를 RBAC·ResourceQuota·NetworkPolicy·Pod Security 여러 겹으로 격리하는 실전 구성을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["멀티테넌시", "네임스페이스", "RBAC", "ResourceQuota", "NetworkPolicy", "격리", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-node-management/)까지는 하나의 클러스터를 한 팀(또는 한 목적)이 쓰는 것을 전제로 했다. 하지만 현실은 다르다. 여러 팀, 여러 프로젝트, 때로는 외부 고객까지 하나의 클러스터를 공유해야 할 때가 많다. 클러스터마다 컨트롤 플레인을 따로 운영하는 비용이 만만치 않기 때문이다. **멀티 테넌시(multi-tenancy)**는 이렇게 하나의 클러스터를 여러 "테넌트(입주자)"가 나눠 쓰되, 서로 간섭하거나 침범하지 못하게 만드는 설계다.

## 격리와 비용의 저울

멀티 테넌시의 모든 결정은 하나의 질문으로 환원된다. "테넌트끼리 얼마나 강하게 격리해야 하는가?" 같은 회사 안의 신뢰할 수 있는 팀들이라면 느슨해도 되지만, 서로 모르는 외부 고객들이라면 강하게 막아야 한다. 그리고 격리를 강화할수록 비용과 운영 부담이 커진다. 이 저울 위에 세 가지 대표 모델이 있다.

![멀티 테넌시 모델 — 격리와 비용의 저울](/assets/posts/k8s-multi-tenancy-models.svg)

**네임스페이스 분리(소프트 멀티테넌시)**는 테넌트마다 네임스페이스를 주고 RBAC·Quota·NetworkPolicy로 경계를 긋는다. 컨트롤 플레인과 노드를 모두 공유하므로 가장 저렴하고 운영이 단순하지만, 같은 커널과 같은 API 서버를 공유한다는 본질적 위험이 남는다.

**가상 클러스터(vCluster 등)**는 테넌트마다 가상의 API 서버를 띄워 API 레벨 격리를 강화한다. 호스트의 노드는 공유하되, 테넌트가 자기만의 CRD와 버전을 가질 수 있다. 격리는 강해지지만 운영 복잡도가 올라간다.

**테넌트별 클러스터(하드 멀티테넌시)**는 아예 클러스터를 통째로 분리한다. 컨트롤 플레인까지 따로이므로 한 테넌트의 사고가 다른 테넌트에 미치는 "폭발 반경"이 최소다. 가장 강한 격리지만 가장 비싸다.

대부분의 조직은 첫 번째 — 네임스페이스 기반 소프트 멀티테넌시 — 에서 시작하므로, 이 글의 나머지는 그것을 안전하게 만드는 방법에 집중한다.

## 격리는 한 겹으로 완성되지 않는다

소프트 멀티테넌시의 핵심 원칙은 **격리를 여러 겹으로 쌓는다**는 것이다. 어느 한 가지 메커니즘만으로는 충분하지 않다. 네임스페이스는 이름 공간을 나눌 뿐, 그 자체로는 권한도 자원도 네트워크도 막지 않는다. 그래서 여러 메커니즘을 겹쳐야 한다.

![소프트 멀티테넌시 — 격리는 여러 겹으로](/assets/posts/k8s-multi-tenancy-isolation-layers.svg)

### 1겹 — RBAC로 권한 가두기

테넌트는 자기 네임스페이스 안에서만 무언가를 할 수 있어야 한다. Role과 RoleBinding으로 권한을 네임스페이스에 가둔다.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: team-a-admin
  namespace: team-a            # 이 네임스페이스에만 유효
subjects:
  - kind: Group
    name: team-a
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role                   # ClusterRole이 아닌 Role → 범위 제한
  name: namespace-admin
  apiGroup: rbac.authorization.k8s.io
```

핵심은 ClusterRoleBinding을 함부로 쓰지 않는 것이다. 클러스터 범위 권한을 테넌트에 주면 다른 테넌트의 리소스까지 보거나 건드릴 수 있다.

### 2겹 — ResourceQuota로 자원 독식 막기

한 테넌트가 클러스터 자원을 다 써버리면 다른 테넌트가 굶는다. ResourceQuota로 네임스페이스별 총량 상한을 두고, LimitRange로 개별 Pod의 기본값·상한을 정한다.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-a-quota
  namespace: team-a
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
```

### 3겹 — NetworkPolicy로 트래픽 차단

기본적으로 쿠버네티스의 모든 Pod는 서로 통신할 수 있다. 멀티 테넌시에서는 이 기본값이 위험하다. 테넌트 네임스페이스에 **deny-all** 정책을 깔아 일단 모두 막고, 같은 테넌트 안의 통신만 명시적으로 허용한다.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: team-a
spec:
  podSelector: {}              # 네임스페이스의 모든 Pod
  policyTypes: [Ingress, Egress]
  # ingress/egress 규칙이 없으면 = 전부 차단
```

### 4겹 — Pod Security와 정책 엔진

테넌트가 특권 컨테이너를 띄우거나 호스트 자원에 접근하면 격리가 무너진다. Pod Security Admission(PSA)으로 네임스페이스에 `restricted` 프로파일을 강제하고, 더 정교한 규칙이 필요하면 Kyverno 같은 정책 엔진을 얹는다.

```bash
# 네임스페이스에 restricted 정책 강제(라벨로)
kubectl label namespace team-a \
  pod-security.kubernetes.io/enforce=restricted
```

### 5겹(선택) — 노드 격리

특히 민감한 테넌트라면 taint와 affinity를 조합해 그 테넌트의 Pod만 전용 노드에 배치할 수 있다. 같은 노드를 공유하면서 생기는 "옆집 소음(noisy neighbor)"과 커널 공유 위험을 줄인다.

## 운영 — 일관성을 자동화하라

테넌트가 늘어날수록 위의 다섯 겹을 매번 손으로 적용하는 것은 비현실적이다. 새 테넌트를 만들 때 네임스페이스 + RBAC + Quota + NetworkPolicy + 보안 정책이 한 묶음으로 생성되도록 자동화해야 한다. Hierarchical Namespace Controller, Capsule, 또는 자체 템플릿/오퍼레이터로 "테넌트 온보딩"을 표준화하는 것이 일관성과 안전의 핵심이다.

## 정리 — 그리고 다음

멀티 테넌시는 격리 강도와 비용 사이의 선택이다. 네임스페이스 분리는 저렴하지만 약하고, 테넌트별 클러스터는 강하지만 비싸며, 가상 클러스터가 그 사이에 있다. 가장 흔한 소프트 멀티테넌시는 RBAC·ResourceQuota·NetworkPolicy·Pod Security를 여러 겹으로 쌓아 격리를 만든다 — 어느 한 겹도 단독으로는 충분하지 않다. 그리고 이 모든 격리는 테넌트 온보딩 자동화로 일관되게 적용돼야 한다.

ResourceQuota로 자원 독식을 막는 이야기가 나왔다. 그런데 자원을 "나눠 막는 것"을 넘어 "낭비 없이 효율적으로 쓰는 것"은 또 다른 큰 주제다. 다음 글에서는 클러스터 자원의 낭비를 줄이는 **비용 최적화**를 다룬다.

---

**지난 글:** [노드 관리 — 추가·격리·교체의 운영 기술](/posts/k8s-node-management/)

**다음 글:** [비용 최적화 — 쿠버네티스 자원 낭비 줄이기](/posts/k8s-cost-optimization/)

<br>
읽어주셔서 감사합니다. 😊
