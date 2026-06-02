---
title: "StatefulSet 스토리지 운영 — PVC 보존과 마이그레이션"
description: "StatefulSet 스케일 다운 시 PVC 보존 동작, persistentVolumeClaimRetentionPolicy 설정, 스토리지 마이그레이션, 업데이트 전략을 실무 관점에서 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "StatefulSet", "PVC", "스토리지", "스케일링", "데이터 마이그레이션"]
featured: false
draft: false
---

[지난 글](/posts/k8s-statefulset/)에서 StatefulSet의 기본 구조와 순서 보장 동작을 살펴봤습니다. 이번에는 **스토리지 운영** 측면을 집중적으로 다룹니다. StatefulSet을 운영하다 보면 스케일 다운 시 PVC는 어떻게 되는지, 스토리지 용량을 늘리려면 어떻게 해야 하는지 같은 실제 문제에 마주치게 됩니다.

## 스케일 다운 시 PVC는 삭제되지 않는다

StatefulSet을 replicas 3에서 1로 줄이면 `web-1`과 `web-2` Pod는 삭제됩니다. 하지만 `data-web-1`과 `data-web-2` PVC는 **자동으로 삭제되지 않습니다**.

이것은 의도적인 설계입니다. 실수로 스케일을 줄였거나, 나중에 다시 올릴 계획이 있을 때 데이터를 보호하기 위해서입니다.

![StatefulSet 스케일 다운 — PVC 보존](/assets/posts/k8s-statefulset-storage-ops-diagram.svg)

스케일을 다시 3으로 올리면 새 `web-1` Pod는 기존 `data-web-1` PVC에 자동으로 재연결됩니다. 데이터가 그대로 복구됩니다.

```bash
# 스케일 다운 (PVC는 유지됨)
kubectl scale sts web --replicas=1

# PVC 여전히 존재 확인
kubectl get pvc -l app=web
# data-web-0  Bound
# data-web-1  Released  ← Pod는 없지만 PVC 존재
# data-web-2  Released

# 스케일 업 → 기존 PVC 재연결
kubectl scale sts web --replicas=3

# web-1이 data-web-1에 재연결됨 확인
kubectl describe pod web-1 | grep "Volumes" -A5
```

## persistentVolumeClaimRetentionPolicy

Kubernetes 1.27에서 GA된 `persistentVolumeClaimRetentionPolicy`로 PVC 생명주기를 세밀하게 제어할 수 있습니다.

```yaml
spec:
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain  # StatefulSet 삭제 시 PVC 유지 (기본값)
    whenScaled: Retain   # 스케일 다운 시 PVC 유지 (기본값)
```

`Delete`로 변경하면 StatefulSet 삭제 또는 스케일 다운 시 해당 PVC도 함께 삭제됩니다. 테스트 환경이나 임시 데이터를 다루는 경우 유용하지만, 프로덕션에서는 신중하게 사용해야 합니다.

## 롤링 업데이트 전략

StatefulSet의 기본 업데이트 전략은 `RollingUpdate`이며, **역순**으로 진행됩니다. replicas가 3이면 `web-2` → `web-1` → `web-0` 순으로 업데이트됩니다.

```bash
# 이미지 업데이트
kubectl set image sts/web web=nginx:1.26

# 업데이트 진행 확인
kubectl rollout status sts/web

# 업데이트 이력
kubectl rollout history sts/web

# 롤백
kubectl rollout undo sts/web
```

**partition** 설정으로 카나리 방식 업데이트도 가능합니다.

```yaml
spec:
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      partition: 2  # index >= 2 인 Pod만 업데이트
```

`partition: 2`로 설정하면 `web-2`만 새 이미지로 업데이트됩니다. 검증 후 partition을 0으로 줄이면 전체 적용됩니다.

![StatefulSet 스토리지 운영 명령어](/assets/posts/k8s-statefulset-storage-ops-commands.svg)

## PVC 용량 확장

기존 PVC의 스토리지를 늘리려면 StorageClass에서 `allowVolumeExpansion: true`가 설정되어 있어야 합니다.

```bash
# StorageClass 확장 가능 여부 확인
kubectl get storageclass standard -o yaml | grep allowVolumeExpansion

# PVC 용량 편집
kubectl edit pvc data-web-0
# spec.resources.requests.storage: 10Gi → 20Gi 변경

# 확장 완료 여부 확인
kubectl get pvc data-web-0
kubectl describe pvc data-web-0 | grep Capacity
```

Pod가 실행 중일 때도 볼륨을 확장할 수 있습니다(CSI 드라이버에 따라 다름). Pod 재시작이 필요할 수도 있습니다.

## volumeClaimTemplates 변경의 제약

`volumeClaimTemplates`는 StatefulSet 생성 후 **변경할 수 없습니다**. 스토리지 클래스나 용량을 변경하려면 다음 절차를 따릅니다.

```bash
# 1. StatefulSet 삭제 (--cascade=orphan: Pod와 PVC는 유지)
kubectl delete sts web --cascade=orphan

# 2. volumeClaimTemplates 변경된 새 StatefulSet 적용
kubectl apply -f web-sts-new.yaml

# 3. 기존 Pod들이 새 StatefulSet에 의해 자동 관리됨
```

`--cascade=orphan` 플래그 없이 삭제하면 Pod와 PVC까지 모두 삭제되므로 반드시 이 옵션을 사용해야 합니다.

## 특정 Pod 디버깅

StatefulSet의 특정 Pod만 격리해 디버깅하려면 labels를 변경합니다.

```bash
# web-1을 StatefulSet 관리에서 격리
kubectl label pod web-1 app=web-debug --overwrite

# StatefulSet이 web-1을 대체하기 위해 새 Pod 생성
kubectl get pods -l app=web
# web-0  Running
# web-1  Running  ← 격리된 원본 (레이블 변경됨)
# web-1a Running  ← StatefulSet이 새로 생성한 Pod

# 격리된 Pod 확인
kubectl get pods -l app=web-debug
```

---

**지난 글:** [쿠버네티스 StatefulSet — 순서와 영속성이 보장되는 Pod](/posts/k8s-statefulset/)

**다음 글:** [쿠버네티스 Job과 CronJob — 일회성·반복 작업](/posts/k8s-job-cronjob/)

<br>
읽어주셔서 감사합니다. 😊
