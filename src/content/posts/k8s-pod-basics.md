---
title: "Kubernetes Pod 기초 — 컨테이너의 실행 단위"
description: "K8s 최소 배포 단위인 Pod의 내부 구조, 네트워크/볼륨 공유 방식, 멀티 컨테이너 패턴, 그리고 자주 쓰는 kubectl 명령을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Pod", "컨테이너", "kubectl", "사이드카", "멀티컨테이너"]
featured: false
draft: false
---

[지난 글](/posts/k8s-yaml-manifests/)에서 YAML 매니페스트 작성법을 익혔다. 이제 Kubernetes에서 가장 핵심이 되는 오브젝트인 **Pod**를 깊이 이해해보자. Pod는 K8s에서 컨테이너를 실행하는 **최소 단위**다.

## Pod란 무엇인가

Pod는 **하나 이상의 컨테이너를 묶은 단위**다. Kubernetes는 컨테이너를 개별로 배포하지 않고, 항상 Pod 단위로 배포한다. Pod 안의 컨테이너들은 다음을 공유한다.

- **네트워크 네임스페이스**: 같은 IP 주소와 포트 공간. 컨테이너끼리 `localhost`로 통신 가능
- **볼륨**: 공유 스토리지 마운트
- **IPC 네임스페이스**: 프로세스 간 통신 가능

반면 **프로세스 네임스페이스**는 기본적으로 분리된다(shareProcessNamespace 옵션으로 공유 가능).

![Pod 내부 구조](/assets/posts/k8s-pod-basics-anatomy.svg)

## 단일 컨테이너 Pod (가장 흔한 패턴)

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
    resources:
      requests:
        cpu: "100m"
        memory: "64Mi"
      limits:
        cpu: "200m"
        memory: "128Mi"
```

대부분의 워크로드는 Pod 하나에 컨테이너 하나다. 하지만 직접 Pod를 작성하는 경우는 드물고, 보통 Deployment나 StatefulSet을 통해 Pod를 관리한다.

## 멀티 컨테이너 Pod

하나의 Pod에 여러 컨테이너를 넣는 경우는 두 컨테이너가 **강하게 결합**되어 있을 때다. 대표 패턴이 **사이드카(Sidecar)** 패턴이다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-sidecar
spec:
  containers:
  # 메인 앱 컨테이너
  - name: app
    image: myapp:v1
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app

  # 사이드카: 로그 수집
  - name: log-collector
    image: fluentd:v1.16
    volumeMounts:
    - name: shared-logs
      mountPath: /var/log/app  # 같은 볼륨 마운트

  volumes:
  - name: shared-logs
    emptyDir: {}               # Pod 수명과 함께하는 임시 볼륨
```

두 컨테이너가 `/var/log/app` 볼륨을 공유한다. 앱이 로그를 파일에 쓰면, 사이드카가 그 파일을 읽어 로그 수집 시스템에 전송한다.

## Pod는 왜 직접 생성하지 않나?

Pod를 직접 `kubectl apply -f pod.yaml`로 생성하면, 해당 Pod가 죽었을 때 자동으로 재생성되지 않는다. Pod는 **임시적(ephemeral)**이다. 그래서 실제 운영에서는 Pod를 관리하는 **상위 오브젝트**를 사용한다.

| 상위 오브젝트 | 용도 |
|---|---|
| Deployment | 무상태 앱, 롤링 업데이트 |
| StatefulSet | 데이터베이스 등 유상태 앱 |
| DaemonSet | 모든 노드에 하나씩 실행 |
| Job/CronJob | 일회성/주기적 배치 작업 |

## Pod 내 컨테이너 통신

같은 Pod 안의 컨테이너는 `localhost`로 통신한다.

```bash
# Pod 내 nginx(80번)와 sidecar(3000번)가 공존할 때
# nginx 컨테이너에서
curl http://localhost:3000

# sidecar 컨테이너에서
curl http://localhost:80
```

포트 충돌에 주의해야 한다. 두 컨테이너가 같은 포트를 열 수 없다.

## kubectl로 Pod 다루기

![Pod 자주 쓰는 kubectl 명령](/assets/posts/k8s-pod-basics-commands.svg)

```bash
# Pod 생성
kubectl run nginx --image=nginx:1.25 --port=80

# Pod YAML 생성 (실제 생성 없이)
kubectl run nginx --image=nginx:1.25 --dry-run=client -o yaml

# 포트 포워딩 (로컬 테스트)
kubectl port-forward pod/nginx-pod 8080:80
# 이후 http://localhost:8080 접근 가능

# Pod 삭제
kubectl delete pod nginx-pod
kubectl delete -f pod.yaml
```

## Pod 상태 확인

```bash
kubectl get pods

# 출력 예시
NAME          READY   STATUS    RESTARTS   AGE
nginx-pod     1/1     Running   0          2m
app-pod       0/2     Pending   0          10s
broken-pod    0/1     Error     3          5m
```

`READY` 컬럼은 `실행중컨테이너/전체컨테이너`를 나타낸다. `2/2`면 두 컨테이너 모두 정상, `0/2`면 모두 비정상이다. `STATUS`가 `Pending`이면 스케줄링 대기 중이고, `CrashLoopBackOff`면 반복 충돌 중이다.

---

**지난 글:** [Kubernetes YAML 매니페스트 작성법](/posts/k8s-yaml-manifests/)

**다음 글:** [Pod 라이프사이클 — Pending부터 Terminating까지](/posts/k8s-pod-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
