---
title: "파드 생명주기 훅: PostStart와 PreStop"
description: "K8s 컨테이너 생명주기 훅인 PostStart와 PreStop의 실행 타이밍, exec/httpGet 핸들러 사용법, graceful shutdown을 위한 실무 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "pod", "lifecycle-hooks", "postStart", "preStop", "graceful-shutdown"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-lifecycle/)에서 파드의 Phase와 Conditions를 살펴봤다. 이번에는 컨테이너 시작/종료 시점에 훅을 실행하는 **생명주기 훅(Lifecycle Hooks)** 을 다룬다. 훅을 이해하면 서비스 중단 없는 graceful shutdown과 기동 시 초기화를 구현할 수 있다.

## 두 가지 훅

K8s는 컨테이너당 두 개의 훅을 제공한다.

- **PostStart**: 컨테이너가 시작된 직후 실행. ENTRYPOINT와 병렬로 실행되므로 순서 보장 없음
- **PreStop**: 컨테이너가 종료되기 직전 실행. 완료 후 SIGTERM이 전송됨

![생명주기 훅 타이밍](/assets/posts/k8s-pod-lifecycle-hooks-timing.svg)

## 핸들러 종류

훅은 두 가지 방식으로 동작을 정의한다.

![훅 핸들러 종류](/assets/posts/k8s-pod-lifecycle-hooks-config.svg)

### exec 핸들러

컨테이너 내부에서 명령어를 실행한다.

```yaml
spec:
  containers:
    - name: app
      image: my-app:1.0
      lifecycle:
        postStart:
          exec:
            command:
              - /bin/sh
              - -c
              - echo "container started" > /tmp/started.txt
        preStop:
          exec:
            command:
              - /bin/sh
              - -c
              - /app/graceful-shutdown.sh
```

### httpGet 핸들러

컨테이너 내의 HTTP 엔드포인트를 호출한다.

```yaml
lifecycle:
  preStop:
    httpGet:
      path: /shutdown
      port: 8080
      scheme: HTTP
```

앱이 `/shutdown` 엔드포인트를 구현해 연결 드레이닝을 수행하면 된다.

### sleep 핸들러 (K8s 1.29+)

K8s 1.29부터 `sleep` 핸들러가 추가됐다.

```yaml
lifecycle:
  preStop:
    sleep:
      seconds: 5
```

## PostStart: 기동 초기화

PostStart는 컨테이너 시작 직후 초기화 작업에 사용한다. 단, ENTRYPOINT와 병렬 실행이라 타이밍 의존성을 피해야 한다. 의존성이 있는 순서 보장 초기화는 **Init 컨테이너**가 더 적합하다.

```yaml
spec:
  containers:
    - name: nginx
      image: nginx:1.27
      lifecycle:
        postStart:
          exec:
            command:
              - /bin/sh
              - -c
              - |
                until curl -s localhost:80/health; do
                  sleep 1
                done
                echo "nginx ready" > /tmp/ready.flag
```

PostStart 훅이 실패하면 컨테이너는 종료되고 restartPolicy에 따라 재시작된다.

## PreStop: Graceful Shutdown

**PreStop은 실무에서 가장 중요한 훅이다.** 파드가 삭제될 때 진행 중인 요청을 완료할 시간을 주기 위해 사용한다.

```yaml
spec:
  terminationGracePeriodSeconds: 60    # 기본 30s, 여유 있게 설정
  containers:
    - name: app
      image: my-app:1.0
      lifecycle:
        preStop:
          exec:
            command:
              - /bin/sh
              - -c
              - |
                # 헬스체크 엔드포인트 비활성화 (LB에서 제거 유도)
                touch /tmp/shutdown-signal
                # 기존 연결 드레이닝 대기
                sleep 10
```

### sleep 트릭: 가장 간단한 graceful shutdown

Service와 Endpoints 갱신에는 수 초의 지연이 있다. PreStop에 sleep을 주면 엔드포인트 제거 후에도 들어오는 요청을 처리할 수 있다.

```yaml
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]
terminationGracePeriodSeconds: 30
```

이 패턴은 단순하지만 대부분의 경우 충분히 효과적이다.

## terminationGracePeriodSeconds

PreStop + SIGTERM 처리 시간의 합이 `terminationGracePeriodSeconds`를 초과하면 SIGKILL로 강제 종료된다.

```bash
# 실제 종료 시퀀스
# T=0   : PreStop 훅 시작
# T=5   : sleep 완료 (PreStop 종료)
# T=5   : SIGTERM 전송
# T=30  : terminationGracePeriodSeconds 초과 → SIGKILL

# 종료 중인 파드 상태 확인
kubectl get pod my-pod -w
# my-pod   1/1   Running     0   5m
# my-pod   1/1   Terminating 0   5m   ← delete 명령 후
# my-pod   0/1   Terminating 0   5m
# (삭제됨)
```

```yaml
# 배포 스펙 예시 - 무중단 배포를 위한 설정
spec:
  terminationGracePeriodSeconds: 60
  containers:
    - name: api
      image: api-server:2.0
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 15"]
      readinessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 5
```

## 훅 실패 처리

```bash
# PostStart 실패 확인
kubectl describe pod my-pod | grep -A 5 "PostStart"

# PreStop 실패 시
# - 컨테이너는 종료 처리 계속
# - 이벤트에 FailedPostStartHook / FailedPreStopHook 기록됨
kubectl events --for pod/my-pod | grep Hook

# 훅 실행 로그 (exec 훅은 컨테이너 로그에 남지 않음)
# kubelet 로그에서 확인 필요
journalctl -u kubelet | grep hook
```

훅은 컨테이너의 생명 전체를 제어하는 강력한 도구다. PreStop + terminationGracePeriodSeconds를 잘 조합하면 배포 중 서비스 다운타임 없이 파드를 교체할 수 있다. 다음 글에서는 하나의 파드에 여러 컨테이너를 함께 실행하는 멀티 컨테이너 패턴을 살펴본다.

---

**지난 글:** [파드(Pod) 생명주기 완전 이해](/posts/k8s-pod-lifecycle/)

**다음 글:** [멀티 컨테이너 파드 패턴: Sidecar, Ambassador, Adapter](/posts/k8s-multi-container-pod/)

<br>
읽어주셔서 감사합니다. 😊
