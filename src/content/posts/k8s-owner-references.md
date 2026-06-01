---
title: "쿠버네티스 Owner References와 가비지 컬렉션"
description: "Kubernetes 리소스 간 소유권을 표현하는 ownerReferences 필드의 구조와, Foreground·Background·Orphan 세 가지 가비지 컬렉션 정책을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "ownerReferences", "가비지 컬렉션", "Deployment", "ReplicaSet", "cascadeDelete"]
featured: false
draft: false
---

[지난 글](/posts/k8s-annotations/)에서 Annotations의 용도와 실전 패턴을 살펴봤습니다. 이번에는 Kubernetes 리소스 간 **소유권(ownership)**을 기록하는 `ownerReferences` 필드와, 상위 리소스 삭제 시 하위 리소스를 어떻게 처리할지 결정하는 **가비지 컬렉션 정책**을 다룹니다.

## ownerReferences란

Kubernetes에서 Deployment가 ReplicaSet을 만들고, ReplicaSet이 Pod를 만들 때, 각 하위 오브젝트의 `metadata.ownerReferences`에는 자신을 만든 상위 오브젝트의 정보가 자동으로 기록됩니다. 이를 통해 가비지 컬렉터(GC)가 상위가 사라졌을 때 하위를 정리할 수 있습니다.

```yaml
# Pod를 describe 또는 -o yaml로 확인 시 자동으로 존재
metadata:
  ownerReferences:
  - apiVersion: apps/v1
    kind: ReplicaSet
    name: web-7d9f8c
    uid: bbb-222-ccc-ddd
    controller: true
    blockOwnerDeletion: true
```

- **uid**: 이름이 같은 오브젝트를 구분하기 위해 UID를 사용합니다. 크로스 네임스페이스 참조는 불가능합니다.
- **controller: true**: 이 ownerReference가 실질적인 컨트롤러임을 나타냅니다. 오브젝트당 하나만 가능.
- **blockOwnerDeletion: true**: Foreground 삭제 시 소유자가 먼저 지워지는 것을 막아 하위 정리가 완료될 때까지 기다리게 합니다.

## Deployment → ReplicaSet → Pod 소유권 체인

```bash
# 소유권 체인 확인
kubectl get replicaset -o yaml | grep -A5 ownerReferences
kubectl get pod web-xxxx -o yaml | grep -A5 ownerReferences
```

![Owner References 소유권 체인](/assets/posts/k8s-owner-references-chain.svg)

Deployment를 삭제하면 GC는 이 체인을 따라 ReplicaSet과 Pod를 순서대로 정리합니다.

## 가비지 컬렉션 정책

삭제 시 `--cascade` 옵션 또는 API의 `propagationPolicy`로 동작을 제어할 수 있습니다.

### Foreground (기본값)

상위 오브젝트에 `deletionTimestamp`를 표시하고, 하위 오브젝트(`blockOwnerDeletion: true`)가 모두 삭제된 후에 상위를 실제로 삭제합니다. 삭제 완료 전까지 상위 오브젝트가 조회됩니다.

```bash
# API를 통한 Foreground 삭제
kubectl delete deployment web --cascade=foreground
```

### Background (kubectl 기본값)

상위 오브젝트를 즉시 삭제하고, GC 컨트롤러가 비동기적으로 하위 오브젝트를 정리합니다. 빠르지만 삭제 완료 여부를 즉시 확인하기 어렵습니다.

```bash
kubectl delete deployment web
# 또는 명시적으로
kubectl delete deployment web --cascade=background
```

### Orphan (고아 정책)

상위 오브젝트만 삭제하고 하위 오브젝트는 남깁니다. 하위 오브젝트에서 ownerReferences가 제거되어 독립 오브젝트가 됩니다.

```bash
# Deployment만 삭제, ReplicaSet과 Pod는 유지
kubectl delete deployment web --cascade=orphan
```

Orphan 정책은 Deployment를 교체하면서 기존 Pod를 유지해야 할 때, 또는 디버깅 목적으로 ReplicaSet을 남겨두어야 할 때 유용합니다.

![ownerReferences 구조와 삭제 정책](/assets/posts/k8s-owner-references-yaml.svg)

## 직접 ownerReferences 설정

컨트롤러를 직접 개발하거나 커스텀 리소스를 다룰 때 ownerReferences를 수동으로 설정할 수 있습니다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
  ownerReferences:
  - apiVersion: apps/v1
    kind: Deployment
    name: web
    uid: aaa-111-bbb  # kubectl get deployment web -o jsonpath='{.metadata.uid}'
    controller: false      # ConfigMap은 Deployment가 직접 제어하지 않음
    blockOwnerDeletion: false
```

`controller: false`로 설정하면 다수의 소유자를 참조할 수 있습니다. Deployment가 삭제될 때 이 ConfigMap도 함께 정리됩니다.

## ownerReferences 확인 방법

```bash
# Pod의 ownerReferences 확인
kubectl get pod web-xxx -o jsonpath='{.metadata.ownerReferences}'

# YAML 전체 출력에서 확인
kubectl get pod web-xxx -o yaml | grep -A10 ownerReferences

# 특정 ownerReference로 연결된 리소스 추적
kubectl get replicaset --selector=app=web
kubectl get pod --selector=app=web
```

## 주의사항

ownerReferences는 **같은 네임스페이스** 내에서만 동작합니다. 클러스터 범위 리소스(PersistentVolume, ClusterRole 등)는 네임스페이스 범위 리소스를 소유할 수 없습니다. 또한 순환 참조(A → B → A)는 허용되지 않으며, API 서버가 검증 단계에서 거부합니다.

---

**지난 글:** [쿠버네티스 Annotations 실전 활용](/posts/k8s-annotations/)

**다음 글:** [쿠버네티스 ReplicaSet 완전 이해](/posts/k8s-replicaset/)

<br>
읽어주셔서 감사합니다. 😊
