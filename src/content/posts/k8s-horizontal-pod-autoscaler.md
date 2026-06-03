---
title: "쿠버네티스 HPA — Pod 수평 자동 스케일링"
description: "Kubernetes HorizontalPodAutoscaler(HPA)의 동작 원리, 스케일링 공식, behavior를 이용한 속도 조절, CPU·메모리 메트릭 기반 설정 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "HPA", "HorizontalPodAutoscaler", "자동 스케일링", "Metrics Server", "CPU", "메모리"]
featured: false
draft: false
---

[지난 글](/posts/k8s-resource-quota/)에서 네임스페이스 총 리소스 사용량을 제한하는 ResourceQuota를 살펴봤습니다. 이번에는 부하에 따라 Pod 수를 **자동으로 늘리거나 줄이는** HorizontalPodAutoscaler(HPA)를 다룹니다.

## HPA란?

HPA는 쿠버네티스 컨트롤러로, Deployment·StatefulSet·ReplicaSet의 `replicas` 필드를 자동으로 조정합니다. 기본 동작은 15초마다 메트릭을 수집하고, 목표값과 현재값을 비교해 필요한 replica 수를 계산합니다.

기본 메트릭은 CPU와 메모리 사용률이며, Metrics Server가 필요합니다. 커스텀 메트릭이나 외부 메트릭을 사용하면 HTTP RPS, 큐 길이 같은 지표로도 스케일링할 수 있습니다 (다음 글에서 다룹니다).

## 스케일링 공식

HPA는 다음 공식으로 필요한 replica 수를 계산합니다.

```
desiredReplicas = ceil(currentReplicas × (currentMetricValue / desiredMetricValue))
```

예를 들어 현재 Pod 2개, CPU 평균 사용률 80%, 목표 50%라면:
```
ceil(2 × 80 / 50) = ceil(3.2) = 4
```

Pod 4개로 스케일 업합니다. 4개가 되면 CPU는 약 40%로 내려가 목표값 이하가 됩니다.

![HPA 스케일링 제어 루프](/assets/posts/k8s-hpa-loop.svg)

## 기본 HPA 설정

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50    # CPU 목표 50%
  - type: Resource
    resource:
      name: memory
      target:
        type: AverageValue
        averageValue: "512Mi"     # 메모리 평균 512MiB
```

CPU는 `Utilization`(request 대비 퍼센트), 메모리는 `AverageValue`(절댓값)로 설정합니다. 메모리를 퍼센트로 설정하면 GC 언어에서 문제가 생길 수 있어 절댓값이 권장됩니다.

## behavior — 스케일 속도 세밀 조정

기본 HPA는 스케일 다운 시 순간적인 부하 급감에 과민 반응할 수 있습니다. `behavior` 필드로 속도를 제어합니다.

![HPA behavior 스케일 속도 조정](/assets/posts/k8s-hpa-behavior.svg)

```yaml
spec:
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0     # 즉시 스케일 업
      policies:
      - type: Pods
        value: 4
        periodSeconds: 60               # 60초마다 최대 4개 추가
      - type: Percent
        value: 100
        periodSeconds: 60               # 60초마다 현재 수의 100%까지
      selectPolicy: Max                 # 두 정책 중 큰 쪽 선택
    scaleDown:
      stabilizationWindowSeconds: 300   # 5분 안정화 창
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60               # 60초마다 최대 10% 축소
      selectPolicy: Min
```

`stabilizationWindowSeconds`는 스케일 다운 시 최근 N초 동안 계산된 replica 수 중 가장 큰 값을 사용합니다. 즉 트래픽이 잠시 줄었다가 다시 올라도 급격히 줄이지 않습니다.

## 자주 겪는 문제

**HPA가 작동 안 할 때**: Metrics Server가 설치됐는지 확인합니다. `kubectl top pods`가 동작하면 Metrics Server는 정상입니다.

```bash
kubectl describe hpa web-hpa
# Events에서 "unable to get metrics" 등 메시지 확인

kubectl get hpa web-hpa
# TARGETS가 <unknown>이면 메트릭 수집 실패
```

**Pod에 requests가 없으면 CPU 퍼센트 계산 불가**: `averageUtilization`은 requests.cpu 대비 비율이므로 반드시 `resources.requests.cpu`를 설정해야 합니다.

**minReplicas와 PDB의 조합**: `minReplicas: 2`와 `pdb.minAvailable: 2`를 동시에 설정하면 드레인 시 Pod 수가 최솟값 이하로 내려갈 수 없어 드레인이 차단됩니다. `minReplicas` ≥ `pdb.minAvailable + 1`로 여유를 두세요.

---

**지난 글:** [쿠버네티스 ResourceQuota — 네임스페이스 총 리소스 사용량 제한](/posts/k8s-resource-quota/)

**다음 글:** [쿠버네티스 HPA 커스텀·외부 메트릭 — Prometheus Adapter와 외부 메트릭 연동](/posts/k8s-hpa-custom-external-metrics/)

<br>
읽어주셔서 감사합니다. 😊
