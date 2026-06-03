---
title: "쿠버네티스 LimitRange — 네임스페이스 내 리소스 기본값과 제한"
description: "Kubernetes LimitRange로 Container·Pod·PVC의 리소스 기본값 자동 주입과 min/max 범위를 제한하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "LimitRange", "리소스 관리", "Admission Controller", "CPU", "메모리", "QoS"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-disruption-budget/)에서 Pod의 자발적 중단을 제어하는 PDB를 다뤘습니다. 이번에는 네임스페이스 수준에서 컨테이너가 사용할 수 있는 리소스의 **기본값과 허용 범위**를 강제하는 LimitRange를 살펴봅니다.

## LimitRange가 필요한 이유

Kubernetes 클러스터를 공유하는 여러 팀이 있을 때, 리소스 설정 없이 Pod를 배포하는 사용자가 생기면 스케줄링에 문제가 생깁니다. requests가 없는 Pod는 BestEffort QoS가 되어 메모리 압박 시 가장 먼저 퇴출됩니다. limits가 없는 Pod는 노드 전체 자원을 독점할 수 있습니다. LimitRange는 이러한 문제를 **Admission Controller 수준에서** 차단합니다.

LimitRange는 네임스페이스별로 존재하며, 해당 네임스페이스에 생성되는 모든 Pod와 PVC에 자동 적용됩니다.

![LimitRange 타입별 제한 범위](/assets/posts/k8s-limit-range-types.svg)

## 세 가지 타입

LimitRange는 `type` 필드로 적용 대상을 지정합니다.

**Container**: 개별 컨테이너에 `default`(limit 기본값), `defaultRequest`(request 기본값), `min`/`max`(허용 범위)를 설정합니다. 가장 많이 쓰이는 타입입니다.

**Pod**: 모든 컨테이너의 합산 리소스에 `min`/`max`를 설정합니다. `default`와 `defaultRequest`는 적용되지 않습니다. 또한 `maxLimitRequestRatio`로 limit/request 비율 상한을 강제할 수 있습니다.

**PersistentVolumeClaim**: PVC 요청 storage 크기의 최솟값과 최댓값을 제한합니다.

## LimitRange YAML 예제

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: dev-team
spec:
  limits:
  - type: Container
    default:            # limits 미지정 시 자동 적용
      cpu: "200m"
      memory: "256Mi"
    defaultRequest:     # requests 미지정 시 자동 적용
      cpu: "100m"
      memory: "128Mi"
    min:
      cpu: "50m"
      memory: "64Mi"
    max:
      cpu: "2"
      memory: "2Gi"
  - type: PersistentVolumeClaim
    min:
      storage: 1Gi
    max:
      storage: 50Gi
```

`default`는 limit이 미지정일 때, `defaultRequest`는 request가 미지정일 때 채워집니다. 이미 명시된 값은 변경하지 않습니다.

## Admission Controller 처리 흐름

Pod 생성 요청이 들어오면 kube-apiserver는 `LimitRanger` Admission Controller를 실행합니다.

![LimitRange Admission 처리 흐름](/assets/posts/k8s-limit-range-admission.svg)

먼저 **뮤테이션(Mutating)** 단계에서 기본값을 주입합니다. requests와 limits가 없는 컨테이너에 `defaultRequest`와 `default` 값을 채웁니다. 이후 **밸리데이션(Validating)** 단계에서 `min ≤ request ≤ max` 조건을 검사합니다. 위반하면 403으로 Pod 생성을 거부합니다.

```bash
# LimitRange 확인
kubectl get limitrange -n dev-team

# 생성된 Pod에 기본값이 주입됐는지 확인
kubectl describe pod mypod -n dev-team | grep -A 8 "Limits:"
# Limits:
#   cpu:     200m
#   memory:  256Mi
# Requests:
#   cpu:     100m
#   memory:  128Mi
```

## 주의사항

**`default`와 `defaultRequest` 관계**: `default`(limit)가 `defaultRequest`(request)보다 크거나 같아야 합니다. 역전되면 LimitRange 자체 생성이 실패합니다.

**기존 Pod에는 소급 적용되지 않습니다.** LimitRange를 네임스페이스에 추가해도, 이미 실행 중인 Pod의 리소스 설정은 변경되지 않습니다. 새로 생성되는 Pod부터 적용됩니다.

```yaml
# 잘못된 설정 예 — LimitRange 생성 실패
limits:
- type: Container
  default:
    cpu: "100m"   # limit이 request보다 작음
  defaultRequest:
    cpu: "200m"   # ERROR: defaultRequest > default
```

**Pod 타입과 Container 타입 함께 사용**: Container 타입의 max가 1 CPU이고, Pod 타입의 max가 3 CPU라면 최대 3개의 컨테이너가 각 1 CPU씩 가질 수 있습니다. 두 조건을 모두 만족해야 허용됩니다.

## ResourceQuota와의 차이

LimitRange는 **개별 객체(Container/Pod/PVC)의 크기**를 제한합니다. ResourceQuota는 **네임스페이스 전체 합산 사용량**을 제한합니다. 두 기능은 상호 보완적이며 함께 사용하는 것이 일반적입니다. 다음 글에서 ResourceQuota를 다룹니다.

---

**지난 글:** [쿠버네티스 PodDisruptionBudget — 자발적 중단으로부터 Pod를 보호하는 방법](/posts/k8s-pod-disruption-budget/)

**다음 글:** [쿠버네티스 ResourceQuota — 네임스페이스 총 리소스 사용량 제한](/posts/k8s-resource-quota/)

<br>
읽어주셔서 감사합니다. 😊
