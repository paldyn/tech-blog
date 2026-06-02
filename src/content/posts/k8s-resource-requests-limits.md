---
title: "쿠버네티스 Resources Requests와 Limits — 노드 자원 배분"
description: "Kubernetes에서 CPU·메모리 requests와 limits의 차이, 스케줄러가 requests를 활용하는 방식, CPU 스로틀링과 OOMKilled 동작, 올바른 설정 가이드를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Resources", "requests", "limits", "OOMKilled", "CPU 스로틀링", "QoS"]
featured: false
draft: false
---

[지난 글](/posts/k8s-probes-liveness-readiness/)에서 프로브로 컨테이너 상태를 모니터링하는 방법을 살펴봤습니다. 이번에는 **리소스 요청과 제한(Requests & Limits)**을 다룹니다. 쿠버네티스에서 리소스 관리는 안정적인 클러스터 운영의 핵심입니다. requests와 limits를 올바르게 설정하지 않으면 한 Pod가 노드 전체 자원을 독점해 다른 Pod가 죽는 "노이지 네이버(Noisy Neighbor)" 문제가 발생합니다.

## requests와 limits의 차이

**requests**: 스케줄러가 Pod를 배치할 노드를 선택할 때 사용하는 **예약된 용량**입니다. 스케줄러는 `Node 할당 가능 자원 - 기존 Pod들의 requests 합산`으로 남은 자원을 계산합니다.

**limits**: 컨테이너가 실제로 사용할 수 있는 **상한선**입니다. 실제 사용량이 limits를 초과하면 CPU는 스로틀링되고, 메모리는 OOMKilled로 컨테이너가 강제 종료됩니다.

requests ≤ limits 관계가 항상 유지되어야 합니다. requests > limits는 오류로 거부됩니다.

![Requests vs Limits 노드 자원 배분](/assets/posts/k8s-resource-requests-limits-diagram.svg)

## CPU와 메모리 단위

**CPU**: 코어 단위 또는 밀리코어(m) 단위
- `1` = 1 vCPU/Core
- `500m` = 0.5 vCPU
- `100m` = 0.1 vCPU (컨테이너 1개당 최소 10ms/100ms 사용)

**메모리**: 이진 단위(Mi, Gi) 또는 십진 단위(M, G)
- `128Mi` = 134,217,728 bytes (=128 × 2²⁰)
- `128M` = 128,000,000 bytes (≠ 128Mi, 약 3% 차이)
- 이진 단위 사용 권장

```yaml
resources:
  requests:
    cpu: "500m"      # 0.5 코어 예약
    memory: "128Mi"  # 128 MiB 예약
  limits:
    cpu: "1000m"     # 최대 1 코어
    memory: "256Mi"  # 최대 256 MiB
```

## CPU 초과 시: 스로틀링

CPU limits를 초과하면 커널의 CFS(Completely Fair Scheduler)가 컨테이너의 CPU 사용을 강제로 줄입니다. 컨테이너는 죽지 않지만 **응답이 느려집니다**. 스로틀링 비율이 높으면 API 응답시간이 늘어나고, 타임아웃이 발생할 수 있습니다.

```bash
# CPU 스로틀링 확인
kubectl top pod web-pod --containers

# 더 자세한 확인 (node-exporter 활용 시)
# container_cpu_cfs_throttled_seconds_total
```

CPU limits를 설정하지 않으면 노드의 남은 모든 CPU를 사용할 수 있어 스로틀링은 없지만, 다른 Pod에 영향을 줄 수 있습니다. 고성능 배치 처리가 아닌 일반 서비스에서는 limits 설정을 권장합니다.

## 메모리 초과 시: OOMKilled

메모리는 CPU와 달리 압축할 수 없습니다. limits를 초과하면 리눅스 커널의 OOM Killer가 컨테이너 프로세스를 즉시 종료합니다. Pod가 `OOMKilled` 상태가 됩니다.

```bash
# OOMKilled 확인
kubectl describe pod web-pod | grep -A3 "Last State"
# Last State:     Terminated
#   Reason:       OOMKilled
#   Exit Code:    137
```

Exit Code 137은 `128 + SIGKILL(9)`을 의미합니다. OOMKilled가 반복된다면 memory limits를 늘리거나 애플리케이션의 메모리 누수를 확인해야 합니다.

![Resources YAML과 관련 명령어](/assets/posts/k8s-resource-requests-limits-yaml.svg)

## requests만 설정할 때의 동작

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  # limits 미설정
```

limits가 없으면 컨테이너는 노드의 남은 모든 자원을 사용할 수 있습니다. CPU는 스로틀링 없음, 메모리는 노드 전체까지 사용 가능합니다. 노드 메모리가 부족해지면 이 컨테이너가 OOMKilled 대상이 될 수 있습니다.

## limits만 설정할 때의 동작

```yaml
resources:
  limits:
    cpu: "500m"
    memory: "256Mi"
  # requests 미설정 → requests = limits로 자동 설정
```

requests를 설정하지 않으면 **requests = limits**로 자동 설정됩니다. 즉, 스케줄러는 500m CPU, 256Mi 메모리를 예약합니다. 실제 사용량과 관계없이 노드에 이만큼 자원이 있어야 배치됩니다.

## 올바른 설정 전략

**프로덕션 권장**: requests와 limits 모두 설정. requests는 일반적인 사용량 기준, limits는 피크 사용량 기준으로 설정합니다.

```yaml
resources:
  requests:
    cpu: "100m"      # 평소 사용량
    memory: "128Mi"
  limits:
    cpu: "500m"      # 피크 시 최대 사용량
    memory: "256Mi"
```

**Guaranteed QoS 원하는 경우**: requests == limits 설정합니다.

```yaml
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
  limits:
    cpu: "500m"      # requests와 동일
    memory: "256Mi"
```

노드별 실제 사용량은 `kubectl top node`, `kubectl top pod`로 확인하고, Prometheus와 Grafana로 추세를 모니터링해 requests/limits 값을 점진적으로 조정하는 것이 좋습니다.

---

**지난 글:** [Liveness · Readiness · Startup Probe — 자가 치유와 트래픽 제어](/posts/k8s-probes-liveness-readiness/)

**다음 글:** [쿠버네티스 QoS 클래스 — Guaranteed, Burstable, BestEffort](/posts/k8s-quality-of-service/)

<br>
읽어주셔서 감사합니다. 😊
