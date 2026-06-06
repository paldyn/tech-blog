---
title: "Pod 라이프사이클 — Pending부터 Terminating까지"
description: "Kubernetes Pod가 생성되어 삭제되기까지의 전체 단계(Pending, Running, Succeeded, Failed, Unknown)와 restartPolicy, graceful shutdown 메커니즘을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Pod", "라이프사이클", "restartPolicy", "CrashLoopBackOff", "gracefulShutdown"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-basics/)에서 Pod의 기본 구조를 배웠다. Pod는 단순히 "실행 중이거나 아니거나"가 아니라 여러 단계(Phase)를 거친다. 이 라이프사이클을 이해하면 장애 디버깅이 훨씬 쉬워진다.

## Pod Phase (단계)

![Pod 라이프사이클 단계](/assets/posts/k8s-pod-lifecycle-phases.svg)

| Phase | 의미 |
|---|---|
| Pending | 스케줄링 대기 중, 또는 이미지 다운로드 중 |
| Running | 하나 이상의 컨테이너가 실행 중 |
| Succeeded | 모든 컨테이너가 exit 0으로 정상 종료 |
| Failed | 하나 이상의 컨테이너가 비정상 종료(exit ≠ 0) |
| Unknown | 노드 통신 불가로 상태 파악 불가 |

주의: Phase는 Pod 전체의 상태고, **컨테이너 State**(Waiting/Running/Terminated)는 개별 컨테이너의 상태다. Pod가 Running이어도 컨테이너는 Waiting(이미지 풀 중)일 수 있다.

## Pod 생성 흐름 상세

```
kubectl apply → API Server → etcd 저장 → [Phase: Pending]
     ↓
kube-scheduler: 적합 노드 선택 → spec.nodeName 기록
     ↓
kubelet (해당 노드): Pod 감지 → 이미지 풀 → Init 컨테이너 실행
     ↓
Init 컨테이너 완료 → 앱 컨테이너 시작 → [Phase: Running]
     ↓
Readiness Probe 통과 → Service 엔드포인트에 등록 (트래픽 수신 시작)
```

Readiness Probe를 통과하기 전까지 Service가 트래픽을 이 Pod에 보내지 않는다. 그래서 Probe 설정이 배포 안정성에 직결된다.

## restartPolicy

![restartPolicy 비교](/assets/posts/k8s-pod-lifecycle-restart.svg)

```yaml
spec:
  restartPolicy: Always    # 기본값. Deployment에 필수
  # restartPolicy: OnFailure  # Job에 사용
  # restartPolicy: Never      # 1회 실행 후 분석 목적
  containers:
  - name: app
    image: myapp:v1
```

컨테이너가 종료되면 kubelet이 재시작하는데, 연속으로 실패하면 **지수 백오프(Exponential Backoff)**가 적용된다.

```
1회 실패 → 10초 대기
2회 실패 → 20초 대기
3회 실패 → 40초 대기
...최대 5분(300초) 대기
```

이 상태가 `kubectl get pods`에서 `CrashLoopBackOff`로 표시된다. BackOff 중인 상태라는 뜻이지, 컨테이너가 죽은 게 아니다. 10분 정상 실행 시 카운터가 리셋된다.

## Graceful Shutdown (종료 흐름)

`kubectl delete pod` 또는 Deployment 업데이트 시 Pod 삭제가 발생한다.

```
1. K8s: Pod에 SIGTERM 전송 + Service 엔드포인트에서 제거
2. gracePeriodSeconds 동안 대기 (기본 30초)
3. 컨테이너가 자체 정리 후 exit
   → 30초 내 종료 안 되면 SIGKILL 강제 종료
```

```yaml
spec:
  terminationGracePeriodSeconds: 60  # 기본 30, 최대 값 없음
  containers:
  - name: app
    image: myapp:v1
    lifecycle:
      preStop:             # SIGTERM 전에 먼저 실행
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]
```

`preStop` 훅은 로드 밸런서에서 Pod가 제거되기 전에 잠시 대기하거나, 진행 중인 요청을 마무리하는 데 유용하다.

## Conditions (상세 상태)

Pod Phase 외에 `Conditions`로 더 세밀한 상태를 확인할 수 있다.

```bash
kubectl describe pod my-pod

# Conditions:
#   Type              Status
#   Initialized       True    # Init 컨테이너 완료
#   Ready             True    # Readiness Probe 통과
#   ContainersReady   True    # 모든 컨테이너 준비됨
#   PodScheduled      True    # 노드 배정 완료
```

`Ready`가 False인데 Pod가 Running이면, Readiness Probe 실패나 Init 컨테이너 문제일 가능성이 높다.

## 라이프사이클 이벤트 확인

```bash
# Pod 이벤트 확인 (가장 먼저 볼 곳)
kubectl describe pod my-pod | grep -A 20 Events

# 이벤트만 별도 조회
kubectl get events --field-selector involvedObject.name=my-pod --sort-by=.lastTimestamp
```

스케줄링 실패, 이미지 풀 에러, OOMKilled 등 대부분의 문제가 Events 섹션에 기록된다.

---

**지난 글:** [Kubernetes Pod 기초](/posts/k8s-pod-basics/)

**다음 글:** [Pod 라이프사이클 훅 — postStart와 preStop](/posts/k8s-pod-lifecycle-hooks/)

<br>
읽어주셔서 감사합니다. 😊
