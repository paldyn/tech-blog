---
title: "쿠버네티스 Rolling Update와 Rollback"
description: "Kubernetes Deployment의 롤링 업데이트가 어떤 순서로 Pod를 교체하는지, kubectl rollout 명령으로 업데이트를 관리하고 이전 버전으로 롤백하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Rolling Update", "Rollback", "Deployment", "kubectl rollout", "무중단 배포"]
featured: false
draft: false
---

[지난 글](/posts/k8s-deployment-basics/)에서 Deployment의 기본 구조를 다뤘습니다. 이번에는 Deployment의 핵심 기능인 **Rolling Update**와 **Rollback**을 심층적으로 살펴봅니다. 무중단 배포가 어떤 메커니즘으로 이루어지는지, 문제 발생 시 어떻게 즉시 이전 버전으로 복구하는지를 단계별로 설명합니다.

## Rolling Update란

Rolling Update는 기존 Pod를 모두 종료한 후 새 Pod를 시작하는 Recreate 방식과 달리, **기존 Pod를 순차적으로 교체**합니다. 교체 중에도 일부 구 버전 Pod가 트래픽을 처리하므로 서비스 중단 없이 배포가 가능합니다.

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 동시에 추가 가능한 최대 Pod 수
      maxUnavailable: 1    # 동시에 Unavailable 허용 최대 Pod 수
```

`replicas: 4`에 `maxSurge: 1`, `maxUnavailable: 1`이면 롤링 업데이트 중 최소 3개 Pod(4-1)가 항상 Ready 상태이고, 최대 5개(4+1)가 존재합니다.

## 단계별 롤링 업데이트 흐름

![Rolling Update 흐름 (replicas: 4)](/assets/posts/k8s-rolling-update-flow.svg)

1. **Step 0**: v1 Pod 4개 Running
2. **Step 1**: v2 Pod 1개 추가 (maxSurge=1) → 총 5개
3. **Step 2**: v2 Pod가 Ready되면 v1 Pod 1개 종료 → 총 4개
4. 이 패턴을 반복해 모든 v1이 v2로 교체되면 완료

readinessProbe가 실패하면 v2 Pod가 Ready 상태가 되지 않아 롤아웃이 멈춥니다. 자동으로 중단되므로 불량 버전이 전체 배포되는 것을 막을 수 있습니다.

## 업데이트 트리거 방법

```bash
# 방법 1: 이미지 직접 변경
kubectl set image deployment/web web=nginx:1.26

# 방법 2: YAML 수정 후 apply
# spec.template.spec.containers[0].image 변경 후:
kubectl apply -f web-deployment.yaml

# 방법 3: 환경변수로 강제 롤아웃 (이미지 변경 없이)
kubectl rollout restart deployment/web
```

`spec.template` 하위의 어떤 변경도 롤링 업데이트를 트리거합니다. `spec.replicas` 변경은 롤링 업데이트가 아닌 단순 스케일링입니다.

## 롤아웃 모니터링

```bash
# 롤아웃 완료까지 대기
kubectl rollout status deployment/web
# Waiting for deployment "web" rollout to finish: 2 out of 4 new replicas have been updated...
# deployment "web" successfully rolled out

# 현재 상태 확인
kubectl get deployment web -o wide
kubectl get replicaset -l app=web
```

CI/CD 파이프라인에서 `kubectl rollout status`는 롤아웃 성공 시 exit code 0, 실패 시 non-zero를 반환하므로 배포 성공/실패를 자동으로 감지할 수 있습니다.

## Rollback

배포 후 문제가 발견되면 즉시 이전 버전으로 되돌릴 수 있습니다. Deployment는 이전 ReplicaSet을 보존하므로 롤백이 빠릅니다.

![kubectl rollout 핵심 명령](/assets/posts/k8s-rolling-update-commands.svg)

```bash
# 직전 버전으로 즉시 롤백
kubectl rollout undo deployment/web

# 롤아웃 히스토리 확인
kubectl rollout history deployment/web
# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         nginx 1.26 upgrade

# 특정 revision으로 롤백
kubectl rollout undo deployment/web --to-revision=1
```

롤백도 롤링 업데이트 방식으로 진행됩니다. Pod가 순차적으로 구 버전으로 교체됩니다.

## 히스토리 관리

`revisionHistoryLimit` 필드로 유지할 이전 ReplicaSet 수를 제어합니다. 기본값은 10입니다.

```yaml
spec:
  revisionHistoryLimit: 5   # 최대 5개의 이전 RS 보존
```

롤백을 위한 revision 정보를 남기려면 `kubernetes.io/change-cause` annotation을 사용합니다.

```bash
# 배포 전 change-cause annotation 추가
kubectl annotate deployment/web \
  kubernetes.io/change-cause="nginx 1.26 업그레이드 (보안 패치)"

# 이후 history에서 확인 가능
kubectl rollout history deployment/web
# REVISION  CHANGE-CAUSE
# 2         nginx 1.26 업그레이드 (보안 패치)
```

## 업데이트 일시 정지

대규모 클러스터에서 점진적으로 배포를 검증하고 싶을 때 롤아웃을 일시 정지할 수 있습니다.

```bash
# 롤아웃 시작 후 즉시 일시 정지
kubectl rollout pause deployment/web

# 일부 Pod만 새 버전으로 교체된 상태에서 검증
# ...검증 완료 후...

# 롤아웃 재개
kubectl rollout resume deployment/web
```

이 패턴은 Canary 배포의 간단한 형태로 활용할 수 있습니다. 단, pause 상태에서 HPA가 스케일을 조정하면 예상치 못한 Pod 수가 될 수 있으니 주의하세요.

---

**지난 글:** [쿠버네티스 Deployment 기초](/posts/k8s-deployment-basics/)

**다음 글:** [maxSurge와 maxUnavailable 심층 분석](/posts/k8s-deployment-maxsurge-maxunavailable/)

<br>
읽어주셔서 감사합니다. 😊
