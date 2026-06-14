---
title: "파드(Pod) 생명주기 완전 이해"
description: "K8s Pod의 5가지 Phase(Pending/Running/Succeeded/Failed/Unknown), 4가지 Conditions, restartPolicy, 생성부터 삭제까지 전체 타임라인을 깊이 분석합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "pod", "lifecycle", "phase", "conditions", "restartPolicy"]
featured: false
draft: false
---

[지난 글](/posts/k8s-krew-plugins/)에서 kubectl 플러그인으로 생산성을 높이는 방법을 살펴봤다. 이제 K8s의 가장 기본 실행 단위인 **파드(Pod)** 의 생명주기를 깊이 이해할 차례다. "왜 내 파드가 Pending에서 안 넘어가지?", "CrashLoopBackOff는 어떤 상태인가?"를 정확히 이해하려면 파드 생명주기를 제대로 알아야 한다.

## Phase: 파드의 큰 그림 상태

파드의 `status.phase`는 5가지 값을 갖는다.

![파드 생명주기 상태 머신](/assets/posts/k8s-pod-lifecycle-phases.svg)

| Phase | 의미 |
|-------|------|
| `Pending` | etcd에 저장됐지만 아직 실행 중이 아님. 스케줄링 대기 또는 이미지 pull 중 |
| `Running` | 노드에 바인딩되어 최소 1개 컨테이너가 실행 중 |
| `Succeeded` | 모든 컨테이너가 exit 0으로 정상 종료 (Job에서 중요) |
| `Failed` | 모든 컨테이너가 종료됐고 최소 1개가 비정상 종료 |
| `Unknown` | 노드와 통신 불가 (노드 장애, 네트워크 분리) |

```bash
# Phase 확인
kubectl get pod my-pod -o jsonpath='{.status.phase}'

# 넓은 시야로 확인
kubectl get pods -o wide

# 모든 파드 Phase 필터링
kubectl get pods --field-selector=status.phase=Pending
kubectl get pods --field-selector=status.phase=Failed
```

## Conditions: 세부 체크포인트

Phase가 큰 그림이라면, **Conditions**는 파드 상태의 세부 체크포인트다.

![파드 생성 타임라인과 Conditions](/assets/posts/k8s-pod-lifecycle-conditions.svg)

4가지 주요 Condition:

| Condition | True 시점 |
|-----------|-----------|
| `PodScheduled` | 스케줄러가 노드 배정 완료 |
| `Initialized` | 모든 Init 컨테이너 성공적으로 완료 |
| `ContainersReady` | 모든 컨테이너가 ready 상태 |
| `Ready` | 파드가 트래픽 수신 가능 (Service Endpoints에 등록) |

```bash
# Conditions 전체 확인
kubectl describe pod my-pod | grep -A 20 "Conditions:"

# jsonpath로 특정 condition 확인
kubectl get pod my-pod -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'

# 모든 condition 타입 확인
kubectl get pod my-pod \
  -o jsonpath='{range .status.conditions[*]}{.type}: {.status}{"\n"}{end}'
```

## restartPolicy: 실패 시 동작

파드 스펙의 `restartPolicy`는 컨테이너 종료 후 동작을 결정한다.

```yaml
spec:
  restartPolicy: Always    # 기본값: 항상 재시작 (Deployment, DaemonSet)
  # restartPolicy: OnFailure  # 비정상 종료 시만 재시작 (Job)
  # restartPolicy: Never      # 재시작 안 함 (Job, 일회성 작업)
  containers:
    - name: app
      image: my-app:1.0
```

```bash
# 재시작 횟수 확인
kubectl get pod my-pod -o jsonpath='{.status.containerStatuses[0].restartCount}'

# RESTARTS 컬럼으로 확인
kubectl get pods
# NAME       READY   STATUS    RESTARTS   AGE
# my-pod     1/1     Running   3          10m  ← 3번 재시작됨
```

**CrashLoopBackOff**는 Phase가 아니다. `Running` Phase에서 컨테이너가 계속 종료되고 재시작을 반복할 때 K8s가 backoff 지연을 증가시키며 표시하는 `status.containerStatuses[].state.waiting.reason`이다.

## 파드 삭제: Terminating과 grace period

파드를 삭제하면 즉시 사라지는 게 아니다.

```bash
# 파드 삭제 (graceful)
kubectl delete pod my-pod

# 삭제 흐름:
# 1. API Server가 deletionTimestamp 설정
# 2. kubelet이 감지 → PreStop hook 실행
# 3. SIGTERM 신호 전송
# 4. terminationGracePeriodSeconds(기본 30s) 대기
# 5. 아직 살아있으면 SIGKILL
# 6. 파드 오브젝트 삭제

# 강제 즉시 삭제 (grace period 0)
kubectl delete pod my-pod --grace-period=0 --force

# Terminating 상태 파드 확인
kubectl get pods | grep Terminating
```

## 파드 상태 자세히 보기

```bash
# 전체 상태 확인
kubectl describe pod my-pod

# 컨테이너 상태 (Running/Waiting/Terminated)
kubectl get pod my-pod -o jsonpath='{.status.containerStatuses}'

# 이전 컨테이너 종료 이유 확인
kubectl get pod my-pod \
  -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'

# Events: 가장 중요한 디버깅 정보
kubectl describe pod my-pod | tail -20
# Events:
#   Warning  FailedScheduling  Insufficient memory
#   Normal   Pulling           Pulling image "my-app:1.0"
#   Normal   Started           Started container app
```

## 파드 재시작과 backoff

restartPolicy=Always일 때 컨테이너가 계속 실패하면 K8s는 재시작 간격을 지수적으로 증가시킨다.

```
10s → 20s → 40s → 80s → 160s → 300s (최대)
```

이게 바로 CrashLoopBackOff다. "백오프 상태에서 다음 재시작을 기다리는 중"이라는 의미다.

```bash
# 재시작 이유 파악
kubectl logs my-pod --previous  # 이전 컨테이너의 로그

# 오류 이유
kubectl describe pod my-pod | grep -A 3 "Last State:"
# Last State:     Terminated
#   Reason:       OOMKilled    ← 메모리 초과
#   Exit Code:    137
```

파드 생명주기를 이해하면 트러블슈팅이 한결 수월해진다. 다음 글에서는 컨테이너 시작/종료 시점에 실행되는 **생명주기 훅(hooks)** 을 살펴본다.

---

**지난 글:** [kubectl 플러그인 매니저 krew 완전 정리](/posts/k8s-krew-plugins/)

**다음 글:** [파드 생명주기 훅: PostStart와 PreStop](/posts/k8s-pod-lifecycle-hooks/)

<br>
읽어주셔서 감사합니다. 😊
