---
title: "Pod 라이프사이클 훅 — postStart와 preStop 완전 해설"
description: "Kubernetes 컨테이너 라이프사이클 훅(postStart, preStop)의 동작 타이밍, 핸들러 타입(exec/httpGet/tcpSocket), 그리고 실전 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Pod", "라이프사이클훅", "postStart", "preStop", "gracefulShutdown"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-lifecycle/)에서 Pod의 Phase(단계)와 restartPolicy를 살펴봤다. 이번에는 컨테이너 시작과 종료 시점에 사용자 코드를 실행할 수 있는 **라이프사이클 훅(Lifecycle Hook)**을 깊이 파헤친다.

## 왜 훅이 필요한가

컨테이너가 시작할 때 초기화 작업이 필요하거나, 종료 전에 진행 중인 요청을 마무리하거나, 외부 시스템에 등록/해제 신호를 보내야 할 때 훅을 사용한다.

K8s는 두 가지 훅을 제공한다.

- **postStart**: 컨테이너 시작 직후 실행
- **preStop**: 컨테이너 종료 전에 실행 (SIGTERM 전)

![Pod 라이프사이클 훅 실행 순서](/assets/posts/k8s-pod-lifecycle-hooks-flow.svg)

## postStart 훅

컨테이너의 `entrypoint`와 **거의 동시에** 비동기로 호출된다. 즉, 앱이 완전히 시작되기 전에 실행될 수 있다. postStart 훅이 실패하면 컨테이너가 종료되고 restartPolicy에 따라 재시작된다.

```yaml
spec:
  containers:
  - name: app
    image: myapp:v1
    lifecycle:
      postStart:
        exec:
          command:
          - /bin/sh
          - -c
          - |
            # 초기화 스크립트
            curl -X POST http://service-registry/register \
              -d '{"host": "$(POD_IP)", "port": 8080}'
```

postStart는 앱 시작 후 **서비스 레지스트리 등록**, **워밍업(캐시 미리 로드)**, **설정 파일 생성** 등에 활용된다.

## preStop 훅

Pod 삭제 신호를 받으면 K8s는 다음 순서로 진행한다.

```
1. Service 엔드포인트에서 Pod IP 제거 (트래픽 차단)
2. preStop 훅 호출
3. SIGTERM 전송
4. terminationGracePeriodSeconds 대기
5. 아직 살아있으면 SIGKILL
```

`preStop`은 SIGTERM이 전송되기 **직전**에 호출된다. 앱이 SIGTERM을 직접 처리한다면 preStop이 없어도 되지만, 처리하지 못하는 경우 preStop에서 정리 작업을 한다.

```yaml
spec:
  terminationGracePeriodSeconds: 60
  containers:
  - name: app
    image: myapp:v1
    lifecycle:
      preStop:
        exec:
          command:
          - /bin/sh
          - -c
          - |
            # 로드 밸런서 제거 후 안정화를 위한 대기
            sleep 5
            # 앱에 정상 종료 신호
            curl -X POST http://localhost:8080/shutdown
```

`sleep 5`를 넣는 이유: Service 엔드포인트에서 제거되더라도 iptables/IPVS 규칙이 즉시 반영되지 않아 잠깐 트래픽이 들어올 수 있다. 짧은 대기로 이 윈도우를 커버한다.

## 핸들러 3가지 타입

![훅 핸들러 3가지 타입](/assets/posts/k8s-pod-lifecycle-hooks-types.svg)

### exec

```yaml
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "nginx -s quit; while killall -0 nginx; do sleep 1; done"]
```

nginx를 graceful하게 종료하는 전형적인 패턴이다. `nginx -s quit`은 현재 요청 처리 후 종료한다.

### httpGet

```yaml
lifecycle:
  postStart:
    httpGet:
      path: /lifecycle/startup
      port: 8080
      httpHeaders:
      - name: X-Hook-Type
        value: postStart
```

앱이 HTTP 서버라면 훅 엔드포인트를 구현해서 초기화 상태를 제어할 수 있다.

### sleep (K8s 1.29+)

```yaml
lifecycle:
  preStop:
    sleep:
      seconds: 10  # exec로 sleep 5 하는 것과 동일하지만 더 명시적
```

K8s 1.29부터 `sleep` 핸들러가 추가돼 `exec: command: [sleep, "5"]`를 대체한다.

## 실전 패턴: Spring Boot 앱

Spring Boot는 `/actuator/shutdown` 엔드포인트로 graceful shutdown을 지원한다.

```yaml
spec:
  terminationGracePeriodSeconds: 90
  containers:
  - name: spring-app
    image: myspring:v1
    env:
    - name: SERVER_SHUTDOWN
      value: graceful          # 진행 중인 요청 완료 후 종료
    - name: SPRING_LIFECYCLE_TIMEOUT-PER-SHUTDOWN-PHASE
      value: 60s
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]
    livenessProbe:
      httpGet:
        path: /actuator/health/liveness
        port: 8080
      initialDelaySeconds: 30
    readinessProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 10
```

`terminationGracePeriodSeconds`는 preStop + 앱 종료 시간의 합보다 충분히 크게 설정해야 한다.

---

**지난 글:** [Pod 라이프사이클](/posts/k8s-pod-lifecycle/)

**다음 글:** [Owner Reference — K8s 오브젝트 소유권 관계](/posts/k8s-owner-references/)

<br>
읽어주셔서 감사합니다. 😊
