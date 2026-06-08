---
title: "Node Cordon과 Drain — 안전한 노드 유지보수 절차"
description: "kubectl cordon/drain/uncordon 명령어의 동작 원리, PDB 존중 방식, --ignore-daemonsets/--delete-emptydir-data 옵션, 안전한 노드 교체 절차를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "cordon", "drain", "uncordon", "node-management", "maintenance", "pdb"]
featured: false
draft: false
---

[지난 글](/posts/k8s-descheduler/)에서 Descheduler로 불균형한 Pod 배치를 자동으로 재조정하는 방법을 살펴봤다. 이번에는 인간이 직접 노드를 작업할 때 필요한 **Cordon, Drain, Uncordon** 절차를 다룬다. OS 패치, 커널 업그레이드, 하드웨어 교체 같은 유지보수 작업을 하려면 먼저 노드에서 Pod를 안전하게 비워야 한다. 이 절차를 정확히 이해하지 않으면 서비스 중단이 발생할 수 있다.

## 전체 절차

![Node Cordon / Drain 절차](/assets/posts/k8s-node-cordon-drain-flow.svg)

**1단계 Cordon**: 노드를 `SchedulingDisabled` 상태로 만든다. 새 Pod는 이 노드에 스케줄되지 않지만, 기존 Pod는 계속 실행된다. 노드 레이블 `node.kubernetes.io/unschedulable: true` Taint가 추가된다.

**2단계 Drain**: 노드의 모든 Pod를 graceful하게 축출한다. Drain 명령 내부적으로 Cordon도 포함하므로, Drain만 실행해도 Cordon 효과가 함께 적용된다.

**3단계 작업**: Pod가 모두 이동한 상태에서 안전하게 유지보수 작업을 수행한다.

**4단계 Uncordon**: 작업 완료 후 노드를 스케줄 가능 상태로 복원한다.

## drain 명령 상세

![kubectl drain 주요 옵션](/assets/posts/k8s-node-drain-commands.svg)

```bash
# 실무에서 가장 많이 쓰는 drain 명령
kubectl drain node-1 \
  --ignore-daemonsets \
  --delete-emptydir-data \
  --timeout=300s
```

`--ignore-daemonsets`는 필수 옵션이다. DaemonSet Pod는 노드에 항상 1개씩 실행되어야 하므로 drain 대상에서 제외한다. 이 옵션 없이 drain하면 DaemonSet Pod 때문에 오류가 발생한다.

`--delete-emptydir-data`는 `emptyDir` 볼륨을 사용하는 Pod를 축출할 때 해당 데이터를 삭제하도록 허용한다. 이 옵션 없이 emptyDir Pod가 있으면 drain이 실패한다. emptyDir은 임시 데이터이므로 일반적으로 안전하다.

## PDB와 Drain의 관계

Drain은 기본적으로 PodDisruptionBudget(PDB)을 존중한다. PDB가 `minAvailable: 2`로 설정된 서비스에 3개 레플리카가 있다면, Drain은 한 번에 1개씩만 축출하며 각 축출 후 Pod가 다른 노드에서 실행될 때까지 기다린다.

```bash
# PDB가 있는 경우 drain이 느려질 수 있음
# 상황 확인
kubectl get pdb --all-namespaces

# drain 진행 상황 모니터링
kubectl get pods --field-selector spec.nodeName=node-1 -w
```

PDB 때문에 drain이 오랫동안 블록되면 다음을 확인한다.
- 다른 노드에 Pod가 재배치될 공간이 있는가?
- PDB의 `minAvailable` 조건을 현재 레플리카 수가 만족할 수 있는가?

## 일반적인 문제 해결

**drain이 멈추는 경우:**

```bash
# 어떤 Pod가 drain을 막고 있는지 확인
kubectl describe node node-1 | grep -A10 "Eviction"

# standalone Pod (ReplicaSet 없는) 확인
kubectl get pods --field-selector spec.nodeName=node-1 \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.metadata.ownerReferences[0].kind}{"\n"}{end}'
```

ReplicaSet, Deployment, DaemonSet, StatefulSet이 없는 standalone Pod는 `--force` 없이 축출되지 않는다. `--force` 옵션은 이런 Pod를 강제 삭제하지만, 데이터 손실 위험이 있으므로 주의해야 한다.

**StatefulSet Pod 주의:**

StatefulSet Pod를 drain할 때는 PersistentVolume이 다른 노드에서 마운트 가능한지 먼저 확인한다. 로컬 PV(local persistent volume)를 사용하는 경우 다른 노드로 이동 자체가 불가능하므로, 해당 Pod는 Pending 상태가 된다.

## Cordon만 사용하는 경우

Drain 없이 Cordon만 사용하는 상황도 있다.

```bash
# 새 Pod 배치를 막고 싶지만 기존 Pod는 유지
kubectl cordon node-1

# 특정 조건의 노드만 cordon
kubectl get nodes -l disktype=ssd -o name | \
  xargs -I{} kubectl cordon {}
```

클러스터 자동 스케일러가 노드를 축소할 때도 내부적으로 Cordon을 사용한다. 현재 cordon된 노드 목록은 `kubectl get nodes`에서 `STATUS` 컬럼에 `SchedulingDisabled`로 표시된다.

## Uncordon과 노드 복귀

```bash
# 작업 완료 후 스케줄 가능 상태로 복원
kubectl uncordon node-1

# 복원 확인
kubectl get node node-1
# STATUS: Ready
```

Uncordon 후에는 일반 Scheduler가 새 Pod를 이 노드에 배치하기 시작한다. 단, 이미 다른 노드에서 실행 중인 Pod들은 자동으로 이동하지 않는다. 균형을 맞추려면 앞서 다룬 Descheduler를 사용한다.

---

**지난 글:** [Descheduler — 실행 중인 Pod를 더 나은 노드로 재배치](/posts/k8s-descheduler/)

**다음 글:** [Custom Resources와 CRD — 쿠버네티스 API 확장](/posts/k8s-custom-resources-crd/)

<br>
읽어주셔서 감사합니다. 😊
