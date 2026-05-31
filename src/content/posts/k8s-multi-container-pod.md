---
title: "멀티 컨테이너 파드 패턴: Sidecar, Ambassador, Adapter"
description: "하나의 파드에 여러 컨테이너를 함께 실행하는 세 가지 디자인 패턴(Sidecar/Ambassador/Adapter), 공유 볼륨과 네트워크 네임스페이스 활용법을 실전 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "pod", "multi-container", "sidecar", "ambassador", "adapter", "emptyDir"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-lifecycle-hooks/)에서 파드 생명주기 훅을 살펴봤다. 이번에는 하나의 파드에 여러 컨테이너를 함께 실행하는 **멀티 컨테이너 파드** 패턴을 알아보자. 파드는 단순히 컨테이너 묶음이 아니라 **공유 리소스(네트워크, 볼륨)를 가진 논리적 실행 단위**다. 이 특성을 잘 활용하면 관심사를 깔끔하게 분리할 수 있다.

## 멀티 컨테이너의 핵심: 공유 리소스

같은 파드 내 컨테이너들은 두 가지를 공유한다.

![멀티 컨테이너 공유 리소스](/assets/posts/k8s-multi-container-pod-shared.svg)

1. **네트워크 네임스페이스**: 같은 파드 IP를 사용. `localhost`로 서로 접근 가능
2. **볼륨**: 동일한 볼륨을 각 컨테이너에 마운트해 파일 공유

## 세 가지 패턴

![멀티 컨테이너 파드 패턴](/assets/posts/k8s-multi-container-pod-patterns.svg)

### Sidecar 패턴

메인 컨테이너를 **보조**하는 사이드카 컨테이너를 붙이는 패턴이다. 가장 범용적이다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-log-sidecar
spec:
  volumes:
    - name: log-volume
      emptyDir: {}
  containers:
    - name: app                          # 메인 컨테이너
      image: my-app:1.0
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
    - name: log-collector                # 사이드카
      image: fluent/fluentd:v1.16
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
          readOnly: true
```

메인 앱은 로그를 `/var/log/app`에 쓰기만 하면 된다. 사이드카가 그 파일을 읽어 Elasticsearch나 Loki에 전송한다. 앱 코드를 수정하지 않고 로그 수집 방식을 바꿀 수 있다는 게 핵심이다.

**Envoy 프록시** 도 대표적인 사이드카다. 서비스 메시(Istio, Linkerd)는 파드마다 Envoy를 자동 주입해 트래픽 제어, mTLS, 관찰성을 제공한다.

### Ambassador 패턴

메인 컨테이너의 **외부 통신을 대리**하는 패턴이다. 앱은 항상 localhost로 ambassador에 연결하고, ambassador가 실제 외부 서비스로 요청을 전달한다.

```yaml
spec:
  containers:
    - name: app
      image: my-app:1.0
      env:
        - name: DB_HOST
          value: localhost     # ambassador 주소 (localhost)
        - name: DB_PORT
          value: "5432"
    - name: db-ambassador      # 앰배서더: DB 연결 풀링 프록시
      image: pgbouncer:1.21
      env:
        - name: DB_HOST
          value: postgres.prod.svc.cluster.local
        - name: POOL_SIZE
          value: "10"
      ports:
        - containerPort: 5432
```

앱은 localhost:5432만 알면 된다. 실제 DB 주소, 연결 풀링, SSL 설정은 ambassador가 처리한다. 환경 변경 시 앱 코드나 이미지를 바꿀 필요 없이 ambassador 설정만 수정한다.

### Adapter 패턴

메인 컨테이너의 **출력을 표준 형식으로 변환**하는 패턴이다. 모니터링 통합에 자주 쓰인다.

```yaml
spec:
  containers:
    - name: legacy-app        # 메인: 독자 형식으로 메트릭 노출
      image: legacy-app:2.0
      ports:
        - containerPort: 9999  # 레거시 형식 메트릭 엔드포인트
    - name: metrics-adapter   # 어댑터: Prometheus 형식으로 변환
      image: prom/statsd-exporter:latest
      ports:
        - containerPort: 9102  # Prometheus scrape 포트
      args:
        - --statsd.mapping-config=/etc/statsd/mapping.yaml
```

Prometheus는 adapter가 노출하는 9102를 scrape한다. 레거시 앱을 수정하지 않고 현대적인 모니터링 스택에 통합할 수 있다.

## emptyDir: 컨테이너 간 파일 공유

파드 내 볼륨 공유의 가장 기본 수단이다.

```yaml
spec:
  volumes:
    - name: shared-data
      emptyDir: {}              # 파드 생성 시 빈 디렉토리 생성
      # emptyDir:
      #   medium: Memory        # RAM 디스크 (더 빠름)
      #   sizeLimit: 512Mi      # 크기 제한

  containers:
    - name: writer
      image: busybox
      command: ["/bin/sh", "-c"]
      args:
        - while true; do
            echo "$(date)" >> /data/timestamp.log;
            sleep 5;
          done
      volumeMounts:
        - name: shared-data
          mountPath: /data

    - name: reader
      image: busybox
      command: ["/bin/sh", "-c", "tail -f /data/timestamp.log"]
      volumeMounts:
        - name: shared-data
          mountPath: /data
          readOnly: true        # 읽기 전용으로 마운트
```

`emptyDir`는 파드가 삭제되면 같이 사라진다. 영속 데이터는 PVC를 사용해야 한다.

## localhost 통신 예시

```yaml
spec:
  containers:
    - name: app
      image: my-app:1.0
      command:
        - /bin/sh
        - -c
        # sidecar의 9090 포트에 localhost로 접근
        - "curl localhost:9090/metrics && ./start-app.sh"

    - name: sidecar-metrics
      image: prom/node-exporter:latest
      ports:
        - containerPort: 9090
```

```bash
# 멀티 컨테이너 파드에서 특정 컨테이너 접근
kubectl exec -it my-pod -c app -- sh
kubectl exec -it my-pod -c sidecar-metrics -- sh

# 특정 컨테이너 로그
kubectl logs my-pod -c app
kubectl logs my-pod -c sidecar-metrics

# 모든 컨테이너 로그 동시 확인 (stern 사용)
kubectl stern my-pod
```

## 멀티 컨테이너 파드 사용 시 주의사항

멀티 컨테이너 파드는 강력하지만 컨테이너 간 결합도가 높아진다. 파드가 스케줄링될 때 모든 컨테이너의 리소스 요청 합계가 노드에 있어야 한다. 독립적으로 스케일링해야 하는 컴포넌트라면 별도 파드로 분리하는 게 낫다.

```bash
# 파드 내 각 컨테이너 리소스 현황
kubectl top pod my-pod --containers

# 특정 컨테이너 재시작 횟수 확인
kubectl get pod my-pod \
  -o jsonpath='{range .status.containerStatuses[*]}{.name}: {.restartCount}{"\n"}{end}'
```

멀티 컨테이너 패턴을 이해하면 마이크로서비스 아키텍처를 더 유연하게 구성할 수 있다. 컨테이너를 기능 단위로 분리하되 밀접하게 협력해야 하는 요소는 같은 파드에 묶어 localhost 통신과 파일 공유의 이점을 활용하자.

---

**지난 글:** [파드 생명주기 훅: PostStart와 PreStop](/posts/k8s-pod-lifecycle-hooks/)

<br>
읽어주셔서 감사합니다. 😊
