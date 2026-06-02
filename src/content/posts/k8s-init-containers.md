---
title: "쿠버네티스 Init Container — 메인 컨테이너 시작 전 준비 작업"
description: "Kubernetes Init Container의 실행 순서 보장, 메인 컨테이너와의 파일 공유, 서비스 대기 패턴, 네이티브 사이드카와의 차이점을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Init Container", "Pod", "순서 보장", "서비스 대기", "데이터 초기화"]
featured: false
draft: false
---

[지난 글](/posts/k8s-job-cronjob/)에서 일회성·반복 작업을 위한 Job과 CronJob을 살펴봤습니다. 이번에는 **Init Container**를 다룹니다. Init Container는 메인 컨테이너가 시작되기 **전에 실행되고 완료되어야 하는 특수 컨테이너**입니다. 데이터베이스 마이그레이션, 설정 파일 생성, 외부 서비스 대기 등 초기화 작업에 사용됩니다.

## Init Container가 필요한 이유

메인 컨테이너 안에서 초기화 로직을 직접 실행할 수도 있습니다. 하지만 이 방식은 몇 가지 문제가 있습니다.

첫째, 초기화 도구(migrate, git, wget)를 프로덕션 이미지에 포함해야 합니다. 이미지 크기가 커지고 보안 취약점이 늘어납니다.

둘째, 초기화 실패 시 메인 컨테이너도 종료됩니다. readinessProbe가 있어도 서비스에 잠깐 문제가 생길 수 있습니다.

Init Container는 이 두 문제를 해결합니다. 초기화 전용 이미지를 따로 사용하고, Init Container가 모두 완료된 후에만 메인 컨테이너가 시작됩니다.

![Init Container 실행 순서](/assets/posts/k8s-init-containers-sequence.svg)

## 핵심 규칙

- Init Container는 `spec.initContainers` 배열에 정의된 **순서대로 하나씩** 실행됩니다
- 각 Init Container는 **exitCode 0**으로 완료되어야 다음으로 진행됩니다
- 실패 시 `restartPolicy`에 따라 재시도됩니다 (기본: 계속 재시도)
- 모든 Init Container가 완료되어야 메인 컨테이너가 시작됩니다
- Init Container는 `livenessProbe`/`readinessProbe`를 지원하지 않습니다

## Init Container YAML

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
spec:
  initContainers:
  # 1번째: DB 마이그레이션
  - name: db-migrate
    image: myapp-migrate:1.0
    command: ["python", "manage.py", "migrate"]
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: url

  # 2번째: 외부 서비스 대기
  - name: wait-for-redis
    image: busybox:1.35
    command:
    - sh
    - -c
    - until nc -z redis-svc 6379; do
        echo "waiting for redis..."; sleep 2;
      done

  containers:
  - name: app
    image: myapp:1.0
    ports:
    - containerPort: 8080
```

## 공유 볼륨으로 Init → 메인 파일 전달

Init Container와 메인 컨테이너는 `emptyDir` 볼륨으로 파일을 주고받을 수 있습니다. Init Container가 설정 파일을 생성하면 메인 컨테이너가 이를 사용하는 패턴입니다.

```yaml
spec:
  initContainers:
  - name: copy-config
    image: alpine:3.18
    command:
    - sh
    - -c
    - cp /templates/app.conf /config/app.conf &&
        sed -i "s/DB_HOST/${DB_HOST}/g" /config/app.conf
    volumeMounts:
    - name: config
      mountPath: /config

  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: config
      mountPath: /etc/app
      readOnly: true

  volumes:
  - name: config
    emptyDir: {}
```

![Init Container YAML과 공유 볼륨](/assets/posts/k8s-init-containers-yaml.svg)

## 서비스 준비 대기 패턴

외부 서비스(DB, Redis, 메시지 큐)가 준비될 때까지 기다리는 패턴은 매우 자주 사용됩니다.

```bash
# TCP 포트 대기 (busybox nc)
until nc -z postgres-svc 5432; do
  echo "Waiting for PostgreSQL..."; sleep 2;
done
echo "PostgreSQL is ready!"

# HTTP 헬스체크 대기 (curl)
until curl -f http://api-svc/health; do
  echo "Waiting for API..."; sleep 3;
done
```

이 패턴 덕분에 마이크로서비스 배포 순서를 엄격하게 제어하지 않아도 됩니다. 의존하는 서비스가 아직 준비되지 않았다면 Init Container가 대기하기 때문입니다.

## Init Container 디버깅

Init Container가 실패하면 Pod는 `Init:Error` 또는 `Init:CrashLoopBackOff` 상태가 됩니다.

```bash
# Pod 상태 확인
kubectl get pod myapp
# NAME     READY   STATUS     RESTARTS
# myapp    0/1     Init:0/2   0

# Init Container 로그 확인
kubectl logs myapp -c db-migrate

# Init Container 이벤트 확인
kubectl describe pod myapp | grep -A20 "Init Containers"

# Init Container에 직접 접속 (실행 중일 때만)
kubectl exec -it myapp -c wait-for-redis -- sh
```

`Init:0/2`는 2개의 Init Container 중 0개가 완료됐다는 의미입니다.

## startupProbe와의 관계

Init Container를 잘못 사용하는 경우 중 하나가 메인 컨테이너의 느린 시작을 처리하기 위한 경우입니다. 이는 `startupProbe`로 해결하는 것이 올바릅니다. Init Container는 별도의 준비 작업을 위한 것이고, 메인 컨테이너 자체의 시작 시간 문제는 startupProbe가 담당합니다.

---

**지난 글:** [쿠버네티스 Job과 CronJob — 일회성·반복 작업](/posts/k8s-job-cronjob/)

**다음 글:** [쿠버네티스 사이드카 패턴 — 공유 리소스로 기능 확장](/posts/k8s-sidecar-pattern/)

<br>
읽어주셔서 감사합니다. 😊
