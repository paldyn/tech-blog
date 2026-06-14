---
title: "쿠버네티스 파드(Pod) 기초"
description: "쿠버네티스의 최소 배포 단위인 Pod의 구조(컨테이너 공유 네트워크/볼륨, sidecar 패턴, init 컨테이너), 생명주기 상태, 실전 YAML 작성법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "pod", "sidecar", "init-container", "lifecycle"]
featured: false
draft: false
---

[지난 글](/posts/k8s-vs-docker-compose/)에서 Docker Compose와 Kubernetes의 차이를 비교했다. K8s를 이해하는 첫 번째 단계는 **Pod**다. Pod는 K8s가 배포·관리하는 최소 단위이며, 컨테이너를 직접 관리하는 대신 항상 Pod 안에 컨테이너를 넣어 실행한다.

## Pod = 컨테이너의 껍데기

![쿠버네티스 파드 구조](/assets/posts/k8s-pod-basics-anatomy.svg)

Pod는 하나 이상의 컨테이너를 묶은 그룹이다. 같은 Pod 안의 컨테이너는 다음을 공유한다.

- **네트워크 네임스페이스**: 같은 IP를 공유하므로 `localhost`로 서로 통신 가능
- **볼륨**: `emptyDir`, PVC를 공유하면 파일 공유 가능
- **생명주기**: Pod가 종료되면 모든 컨테이너가 종료됨

Docker와 달리 컨테이너 이름으로 통신하지 않고 `localhost`를 사용한다는 점이 핵심이다.

```yaml
# 기본 Pod YAML
apiVersion: v1
kind: Pod
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  containers:
  - name: app
    image: myapp:1.0
    ports:
    - containerPort: 8080
    resources:
      requests:
        cpu: "0.5"
        memory: "256Mi"
      limits:
        cpu: "1"
        memory: "512Mi"
```

```bash
# Pod 생성
kubectl apply -f pod.yaml

# Pod 목록 확인
kubectl get pods -o wide

# Pod 상세 정보
kubectl describe pod myapp

# 로그 확인
kubectl logs myapp -c app
```

## Sidecar 패턴

같은 Pod에 보조 컨테이너(sidecar)를 붙이는 패턴이 자주 사용된다. 메인 앱 컨테이너와 같은 네트워크·볼륨을 공유하므로 프록시, 로그 수집, 모니터링 등의 역할을 맡기기 좋다.

```yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    ports:
    - containerPort: 8080

  # nginx를 앞단 리버스 프록시로 붙이기
  - name: proxy
    image: nginx:alpine
    ports:
    - containerPort: 80
    volumeMounts:
    - name: nginx-config
      mountPath: /etc/nginx/conf.d

  volumes:
  - name: nginx-config
    configMap:
      name: nginx-proxy-config
```

sidecar 내부에서 메인 앱에 접근할 때 `http://localhost:8080`으로 접근한다.

## Init 컨테이너

메인 컨테이너 시작 전에 완료해야 하는 초기화 작업을 `initContainers`에 정의한다. 모든 init 컨테이너가 순서대로 성공해야 메인 컨테이너가 시작된다.

```yaml
spec:
  initContainers:
  - name: wait-for-db
    image: busybox
    command: ["sh", "-c",
      "until nc -z db-service 5432; do echo waiting; sleep 2; done"]

  - name: db-migrate
    image: myapp:1.0
    command: ["node", "scripts/migrate.js"]
    env:
    - name: DB_URL
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: url

  containers:
  - name: app
    image: myapp:1.0
```

## 파드 생명주기

![파드 생명주기](/assets/posts/k8s-pod-basics-lifecycle.svg)

`kubectl get pod` 의 STATUS 필드 변화:

| 상태 | 의미 |
|---|---|
| `Pending` | 노드 스케줄링 대기 중, 이미지 풀 중 |
| `Init:N/M` | N번째 init 컨테이너 실행 중 |
| `Running` | 모든 컨테이너 실행 중 |
| `Succeeded` | 모든 컨테이너 exit 0으로 종료 |
| `Failed` | 하나 이상 컨테이너가 비정상 종료 |
| `CrashLoopBackOff` | 반복 재시작 후 지수 백오프 중 |

```bash
# 상태 추이 실시간 모니터링
kubectl get pod myapp -w

# CrashLoopBackOff 원인 찾기
kubectl logs myapp --previous   # 이전 실행 로그
kubectl describe pod myapp      # Events 섹션 확인

# Pod 강제 삭제
kubectl delete pod myapp --grace-period=0 --force
```

## livenessProbe · readinessProbe

```yaml
containers:
- name: app
  image: myapp:1.0
  livenessProbe:
    httpGet:
      path: /healthz
      port: 8080
    initialDelaySeconds: 10
    periodSeconds: 10
    failureThreshold: 3    # 3회 실패 시 컨테이너 재시작

  readinessProbe:
    httpGet:
      path: /ready
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 5        # 실패 시 서비스 트래픽에서 제외 (재시작 X)
```

`livenessProbe` 실패 → 컨테이너 재시작, `readinessProbe` 실패 → 서비스 엔드포인트에서 제거(재시작 없음). 둘 다 설정하는 것이 실전 권장 패턴이다.

---

**지난 글:** [Kubernetes vs Docker Compose: 무엇을 선택해야 할까?](/posts/k8s-vs-docker-compose/)

**다음 글:** [쿠버네티스 Deployment 기초](/posts/k8s-deployment-basics/)

<br>
읽어주셔서 감사합니다. 😊
