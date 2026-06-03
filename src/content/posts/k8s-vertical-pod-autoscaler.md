---
title: "쿠버네티스 VPA — Pod 수직 자동 스케일링"
description: "Kubernetes VerticalPodAutoscaler(VPA)의 Recommender·Updater·Admission Controller 구조, updateMode 비교, HPA와의 병용 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "VPA", "VerticalPodAutoscaler", "리소스 최적화", "수직 스케일링", "Recommender"]
featured: false
draft: false
---

[지난 글](/posts/k8s-keda-event-driven-autoscaling/)에서 이벤트 기반 수평 스케일링을 다뤘습니다. 이번에는 방향을 바꿔, **Pod 수는 유지하면서 컨테이너의 CPU·메모리 할당량을 자동 조정**하는 VPA(VerticalPodAutoscaler)를 살펴봅니다.

## VPA가 필요한 이유

많은 팀이 resources 설정을 과도하게 높게 잡습니다("혹시 모르니까"). 이로 인해 노드 용량의 상당 부분이 낭비됩니다. VPA는 실제 사용 패턴을 분석해 적절한 requests/limits를 권장하고, 자동으로 적용할 수 있습니다.

## 세 가지 컴포넌트

![VPA 컴포넌트 구조](/assets/posts/k8s-vpa-components.svg)

**Recommender**는 Metrics Server에서 과거 리소스 사용 히스토리를 수집하고 통계 분석을 통해 최적 request/limit 값을 계산합니다. 결과는 VPA 오브젝트의 `status.recommendation` 필드에 기록됩니다.

**Updater**는 현재 실행 중인 Pod가 권장 범위를 벗어났는지 확인합니다. `Auto` 또는 `Recreate` 모드에서 범위를 벗어난 Pod를 퇴출시킵니다.

**Admission Controller**(Webhook)는 신규 Pod가 생성될 때 VPA 권장값을 컨테이너 resources에 주입합니다.

## VPA 오브젝트 설정

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-server
  updatePolicy:
    updateMode: "Off"       # 처음에는 Off로 권장값만 확인
  resourcePolicy:
    containerPolicies:
    - containerName: web
      minAllowed:
        cpu: "50m"
        memory: "64Mi"
      maxAllowed:
        cpu: "4"
        memory: "4Gi"
      controlledResources: ["cpu", "memory"]
```

## updateMode 비교

![VPA updateMode 비교](/assets/posts/k8s-vpa-modes.svg)

`Off`는 권장값만 계산하고 적용하지 않습니다. `Initial`은 신규 Pod 생성 시에만 주입합니다. `Recreate`는 범위를 벗어난 기존 Pod를 퇴출해 재시작합니다. `Auto`는 k8s 1.27+의 In-Place Pod Resize 기능을 활용하거나, 미지원 버전에서는 Recreate처럼 동작합니다.

처음 VPA를 도입할 때는 `Off` 모드로 시작해 권장값을 며칠간 관찰한 뒤 `Initial` → `Auto` 순으로 전환하는 것을 권장합니다.

```bash
# VPA 권장값 확인
kubectl describe vpa web-vpa

# 출력 예시:
# Recommendation:
#   Container Recommendations:
#     Container Name: web
#     Lower Bound:    cpu: 100m, memory: 256Mi
#     Target:         cpu: 250m, memory: 512Mi
#     Upper Bound:    cpu: 500m, memory: 1Gi
```

## HPA와 VPA 병용 주의

**CPU와 메모리를 동시에 HPA와 VPA로 제어하면 충돌합니다.** 예를 들어 HPA가 CPU 기반으로 스케일 업하는 동안 VPA가 CPU requests를 늘리면 서로 피드백 루프가 생깁니다.

안전한 병용 방법은 다음과 같습니다.

```yaml
# HPA는 CPU로 수평 스케일
# VPA는 메모리만 수직 스케일 (CPU 제외)
resourcePolicy:
  containerPolicies:
  - containerName: "*"
    controlledResources: ["memory"]   # CPU 제외
```

또는 HPA를 커스텀 메트릭(RPS 등)으로 설정하고 VPA가 CPU/메모리를 모두 관리하게 할 수도 있습니다.

## Goldilocks — VPA 권장값 시각화

실무에서는 Fairwinds의 [Goldilocks](https://github.com/FairwindsOps/goldilocks) 도구를 함께 사용하는 경우가 많습니다. 네임스페이스의 모든 Deployment에 VPA(`Off` 모드)를 자동 생성하고, 웹 대시보드에서 권장값을 한눈에 볼 수 있습니다.

```bash
# Goldilocks 네임스페이스 활성화
kubectl label ns production goldilocks.fairwinds.com/enabled=true

# VPA 권장값 자동 생성 후 대시보드에서 확인
kubectl port-forward svc/goldilocks-dashboard -n goldilocks 8080:80
```

---

**지난 글:** [쿠버네티스 KEDA — 이벤트 기반 자동 스케일링](/posts/k8s-keda-event-driven-autoscaling/)

**다음 글:** [쿠버네티스 Cluster Autoscaler — 노드 수 자동 조정](/posts/k8s-cluster-autoscaler/)

<br>
읽어주셔서 감사합니다. 😊
