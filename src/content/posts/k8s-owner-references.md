---
title: "Owner Reference — Kubernetes 오브젝트 소유권 관계 완전 해설"
description: "Kubernetes ownerReferences 필드의 동작 원리, Cascade Deletion 방식(Foreground/Background/Orphan), 그리고 Garbage Collector가 고아 오브젝트를 정리하는 방식을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "ownerReference", "GarbageCollection", "CascadeDeletion", "오브젝트관리"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-lifecycle-hooks/)에서 Pod 라이프사이클 훅을 살펴봤다. 이번 글에서는 Kubernetes 오브젝트들이 서로 **소유 관계(Ownership)**를 어떻게 표현하고, 이 관계가 삭제 동작에 어떤 영향을 미치는지 알아본다.

## ownerReferences란

Kubernetes 오브젝트는 `metadata.ownerReferences` 필드로 **자신의 오너(소유자)**를 명시한다. ReplicaSet이 생성한 Pod라면, 그 Pod의 ownerReferences에는 ReplicaSet의 정보가 담긴다.

```yaml
# Pod의 metadata 예시 (kubectl get pod my-pod -o yaml)
metadata:
  name: my-app-7d4b9c-xkzp2
  ownerReferences:
  - apiVersion: apps/v1
    kind: ReplicaSet
    name: my-app-7d4b9c
    uid: a1b2c3d4-...          # 오너의 고유 UID
    controller: true           # 이 오너가 컨트롤러임을 표시
    blockOwnerDeletion: true   # 오너 삭제 전 자신이 먼저 삭제됨
```

## 소유 체인

![Owner Reference 체인](/assets/posts/k8s-owner-references-chain.svg)

Deployment를 생성하면 소유 체인이 형성된다.

```
Deployment → ReplicaSet → Pod (여러 개)
```

각 오브젝트는 자신의 직접적인 오너만 ownerReferences에 기록한다. Pod는 ReplicaSet을 오너로, ReplicaSet은 Deployment를 오너로 가리킨다. Pod가 Deployment를 직접 참조하지는 않는다.

```bash
# 소유 체인 확인
kubectl get replicaset -l app=my-app -o yaml | grep -A5 ownerReferences
kubectl get pod -l app=my-app -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}{"\n"}{end}'
```

## Cascade Deletion (연쇄 삭제)

Deployment를 삭제하면 ReplicaSet도, Pod도 삭제된다. 이것이 Cascade Deletion이다. 방식은 세 가지다.

### Foreground (기본)

```bash
kubectl delete deployment my-app
# 또는 명시적으로
kubectl delete deployment my-app --cascade=foreground
```

1. Deployment의 `deletionTimestamp` 설정 (삭제 예약)
2. GC가 소유된 ReplicaSet부터 삭제
3. ReplicaSet이 소유한 Pod 삭제
4. 모든 하위 오브젝트 삭제 완료 후 Deployment 삭제

삭제 중 Deployment는 API에서 여전히 보이지만 `deletionTimestamp`가 설정되어 있다.

### Background

```bash
kubectl delete deployment my-app --cascade=background
```

오너(Deployment)를 즉시 삭제하고, GC가 고아가 된 ReplicaSet과 Pod를 비동기로 삭제한다. 빠르지만 하위 오브젝트가 일정 시간 남아있을 수 있다.

### Orphan (고아로 남기기)

```bash
kubectl delete deployment my-app --cascade=orphan
```

![Garbage Collection — 고아 오브젝트 정리](/assets/posts/k8s-owner-references-gc.svg)

Deployment만 삭제하고 ReplicaSet과 Pod는 남긴다. 잠시 컨트롤러를 교체하거나 하위 오브젝트를 다른 컨트롤러로 재연결할 때 사용한다.

## ownerReferences 직접 조작

일반적으로 K8s 컨트롤러가 자동으로 ownerReferences를 설정하지만, 커스텀 컨트롤러를 개발할 때 직접 설정하는 경우가 있다.

```go
// controller-runtime 기반 Go 코드 예시
import "sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"

// 오너십 설정: configMap의 오너를 myResource로 지정
err := controllerutil.SetControllerReference(myResource, configMap, r.Scheme)
```

```bash
# kubectl로 직접 patch (비권장 — 컨트롤러에서 처리하는 것이 원칙)
kubectl patch pod my-pod --type=json \
  -p='[{"op":"add","path":"/metadata/ownerReferences","value":[{"apiVersion":"apps/v1","kind":"ReplicaSet","name":"my-rs","uid":"abc123","controller":true,"blockOwnerDeletion":true}]}]'
```

## blockOwnerDeletion

`blockOwnerDeletion: true`로 설정된 오브젝트가 있으면, 오너는 Foreground 삭제 시 이 오브젝트가 먼저 삭제될 때까지 기다린다. `false`로 설정하면 오너가 먼저 삭제될 수 있다.

```bash
# blockOwnerDeletion 확인
kubectl get pod my-pod -o jsonpath='{.metadata.ownerReferences[0].blockOwnerDeletion}'
# true
```

## Garbage Collector

GC 컨트롤러는 Controller Manager 내부에 있으며, 주기적으로 모든 오브젝트의 ownerReferences를 검사한다. 오너 UID가 클러스터에 존재하지 않는 오브젝트를 발견하면 삭제 대기열에 추가한다.

```bash
# 고아 ReplicaSet 찾기 (오너 Deployment가 없는 경우)
kubectl get replicaset --all-namespaces -o json | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
for rs in data['items']:
    owners = rs['metadata'].get('ownerReferences', [])
    if not owners:
        print(rs['metadata']['namespace'] + '/' + rs['metadata']['name'], '(no owner)')
"
```

---

**지난 글:** [Pod 라이프사이클 훅](/posts/k8s-pod-lifecycle-hooks/)

**다음 글:** [ReplicaSet — Pod 복제본을 유지하는 메커니즘](/posts/k8s-replicaset/)

<br>
읽어주셔서 감사합니다. 😊
