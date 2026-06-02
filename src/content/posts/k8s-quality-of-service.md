---
title: "쿠버네티스 QoS 클래스 — Guaranteed, Burstable, BestEffort"
description: "Kubernetes QoS 클래스의 세 가지 종류(Guaranteed/Burstable/BestEffort), 자동 결정 규칙, 메모리 부족 시 퇴출 우선순위, 실무 설정 가이드를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "QoS", "Guaranteed", "Burstable", "BestEffort", "Pod 퇴출", "리소스 관리"]
featured: false
draft: false
---

[지난 글](/posts/k8s-resource-requests-limits/)에서 requests와 limits로 컨테이너 자원을 설정하는 방법을 살펴봤습니다. 이번에는 requests와 limits 설정에 따라 **자동으로 부여되는 QoS(Quality of Service) 클래스**를 다룹니다. QoS 클래스는 노드에 메모리가 부족해질 때 어떤 Pod를 먼저 퇴출할지 결정하는 기준이 됩니다.

## QoS 클래스의 세 종류

쿠버네티스는 Pod를 생성할 때 resources 설정을 분석해 세 가지 QoS 클래스 중 하나를 자동으로 부여합니다. 사용자가 직접 설정할 수는 없습니다.

**Guaranteed**: 가장 높은 보호 등급. 메모리 부족 시 가장 마지막에 퇴출됩니다.

**Burstable**: 중간 등급. limits를 초과한 사용량 비율이 높은 순으로 퇴출됩니다.

**BestEffort**: 가장 낮은 등급. 메모리 부족 시 가장 먼저 퇴출됩니다.

![QoS 클래스 퇴출 우선순위](/assets/posts/k8s-quality-of-service-classes.svg)

## QoS 클래스 결정 규칙

**Guaranteed 조건**: Pod 내 **모든 컨테이너**에서 `requests == limits` 이어야 합니다.
- CPU: requests == limits (둘 다 설정)
- Memory: requests == limits (둘 다 설정)
- 모든 컨테이너(init container 포함) 동일 조건

**BestEffort 조건**: Pod 내 **모든 컨테이너**에 CPU와 메모리 requests, limits가 **전혀 없는** 경우.

**Burstable 조건**: Guaranteed도 BestEffort도 아닌 나머지 모든 경우.
- requests는 있고 limits는 없는 경우
- requests ≠ limits인 경우
- 일부 컨테이너는 설정 있고 일부는 없는 경우

## QoS 클래스 확인

```bash
# Pod의 QoS 클래스 확인
kubectl get pod web-0 \
  -o jsonpath='{.status.qosClass}'

# 네임스페이스 내 모든 Pod QoS 확인
kubectl get pods -o custom-columns=\
'NAME:.metadata.name,QOS:.status.qosClass'

# 출력 예시:
# NAME      QOS
# web-0     Guaranteed
# cache-0   Burstable
# batch-0   BestEffort
```

![QoS 클래스별 YAML 예시](/assets/posts/k8s-quality-of-service-rules.svg)

## Burstable 퇴출 우선순위 계산

Burstable Pod들 사이에서 퇴출 순서는 **requests 대비 실제 사용 비율**로 결정됩니다.

`사용 비율 = 실제 메모리 사용량 / requests`

비율이 높을수록(requests를 많이 초과할수록) 먼저 퇴출됩니다.

예시:
- Pod A: requests=100Mi, 현재 사용=180Mi → 비율 1.8
- Pod B: requests=500Mi, 현재 사용=600Mi → 비율 1.2

Pod A가 먼저 퇴출됩니다.

## 실무 권장 설정

```yaml
# 핵심 서비스 (DB, API 게이트웨이): Guaranteed
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "500m"    # requests와 동일
    memory: "512Mi"

# 일반 서비스 (웹 앱, 마이크로서비스): Burstable
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"

# 배치/비중요 작업: BestEffort
# (resources 미설정 — 운영 환경 비권장)
```

Guaranteed QoS는 노드에서 정확히 그만큼의 자원을 항상 예약합니다. 오버커밋이 없어 자원 효율은 낮지만 안정성이 높습니다. 핵심 컴포넌트에 사용합니다.

Burstable은 평소에는 requests만큼 예약하고, 남는 자원이 있으면 limits까지 사용할 수 있습니다. 자원 효율과 안정성의 균형을 맞출 수 있습니다.

## QoS와 Node MemoryPressure

노드에 메모리가 부족해지면 kubelet이 `MemoryPressure` 컨디션을 설정하고, 다음 순서로 Pod를 퇴출합니다.

1. BestEffort Pod → 메모리 사용량이 많은 순
2. Burstable Pod → requests 초과 비율이 높은 순
3. Guaranteed Pod → 메모리 사용량이 많은 순 (최후 수단)

Guaranteed Pod도 노드 메모리 절대 부족 상황에서는 퇴출될 수 있습니다. 완전한 보호는 아닙니다.

```bash
# 노드 MemoryPressure 확인
kubectl describe node node1 | grep MemoryPressure

# 노드 조건 전체 확인
kubectl get node node1 \
  -o jsonpath='{.status.conditions[*].type}'
# Ready MemoryPressure DiskPressure PIDPressure
```

---

**지난 글:** [쿠버네티스 Resources Requests와 Limits — 노드 자원 배분](/posts/k8s-resource-requests-limits/)

**다음 글:** [쿠버네티스 Pod 퇴출(Eviction) — kubelet의 리소스 보호 메커니즘](/posts/k8s-pod-eviction/)

<br>
읽어주셔서 감사합니다. 😊
