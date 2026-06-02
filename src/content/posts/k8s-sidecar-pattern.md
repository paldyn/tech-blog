---
title: "쿠버네티스 사이드카 패턴 — 공유 리소스로 기능 확장"
description: "Kubernetes 사이드카 패턴의 개념, 로그 수집·프록시·동기화 사이드카 구현 방법, 네이티브 사이드카(1.29+), 서비스 메시와의 관계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "사이드카", "멀티 컨테이너", "Envoy", "Fluentd", "서비스 메시"]
featured: false
draft: false
---

[지난 글](/posts/k8s-init-containers/)에서 메인 컨테이너 시작 전 실행되는 Init Container를 살펴봤습니다. 이번에는 **사이드카 패턴**을 다룹니다. 사이드카는 메인 컨테이너와 **같은 Pod 안에서 함께 실행되며 기능을 확장하는 보조 컨테이너**입니다. 오토바이 사이드카처럼 주 기능(메인 컨테이너)에 부가 기능을 붙이는 개념입니다.

## 사이드카의 핵심 — 공유 리소스

같은 Pod 안의 컨테이너들은 세 가지 리소스를 공유합니다.

1. **네트워크 네임스페이스**: `localhost`로 통신, 포트 충돌 주의
2. **볼륨**: `emptyDir`로 파일 공유
3. **IPC 네임스페이스** (`shareProcessNamespace: true` 설정 시 PID도 공유)

이 공유 리소스를 활용해 메인 컨테이너를 수정하지 않고도 기능을 추가할 수 있습니다.

![사이드카 패턴 아키텍처](/assets/posts/k8s-sidecar-pattern-architecture.svg)

## 로그 수집 사이드카

가장 흔한 사이드카 패턴입니다. 메인 컨테이너가 로그를 파일로 저장하고, 사이드카가 해당 파일을 읽어 중앙 로그 시스템으로 전송합니다.

```yaml
spec:
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: logs
      mountPath: /var/log/nginx

  - name: log-shipper
    image: fluentd:v1.16
    volumeMounts:
    - name: logs
      mountPath: /var/log/nginx
      readOnly: true
    env:
    - name: ELASTICSEARCH_HOST
      value: "elasticsearch-svc"

  volumes:
  - name: logs
    emptyDir: {}
```

메인 컨테이너(nginx)는 로그 전송 방법을 전혀 알지 못합니다. 로그 전송 방식이 변경되어도 nginx 이미지를 수정할 필요가 없습니다.

## 프록시 사이드카 (서비스 메시)

Istio, Linkerd 같은 서비스 메시는 Envoy 프록시를 사이드카로 자동 주입합니다. 모든 인바운드·아웃바운드 트래픽이 Envoy를 통해 흐르면서 mTLS, 서킷 브레이커, 트래픽 관찰이 가능해집니다.

```yaml
# Istio가 자동으로 주입하는 사이드카 (수동 설정 예시)
containers:
- name: app
  image: myapp:1.0

- name: istio-proxy          # Envoy
  image: istio/proxyv2:1.20
  ports:
  - containerPort: 15090     # 메트릭
  - containerPort: 15021     # 헬스체크
```

실제로는 `kubectl label namespace default istio-injection=enabled` 명령으로 네임스페이스에 자동 주입을 활성화합니다. Pod를 생성할 때 Istio의 MutatingAdmissionWebhook이 사이드카를 자동으로 추가합니다.

## Git-Sync 사이드카

웹 서버의 컨텐츠를 Git 레포지터리와 동기화하는 패턴입니다.

```yaml
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    volumeMounts:
    - name: content
      mountPath: /usr/share/nginx/html
      readOnly: true

  - name: git-sync
    image: registry.k8s.io/git-sync/git-sync:v4.2.1
    env:
    - name: GITSYNC_REPO
      value: "https://github.com/myorg/website"
    - name: GITSYNC_PERIOD
      value: "30s"
    - name: GITSYNC_ROOT
      value: /content
    volumeMounts:
    - name: content
      mountPath: /content

  volumes:
  - name: content
    emptyDir: {}
```

git-sync 사이드카가 30초마다 Git 레포를 pull해 공유 볼륨을 업데이트합니다. nginx는 이 볼륨을 마운트해 항상 최신 컨텐츠를 제공합니다.

![사이드카 YAML 구조](/assets/posts/k8s-sidecar-pattern-yaml.svg)

## 네이티브 사이드카 (Kubernetes 1.29+)

Kubernetes 1.29에서 네이티브 사이드카 컨테이너가 GA됐습니다. `initContainers`에 `restartPolicy: Always`를 설정하면 Init Container처럼 시작하지만, 완료되지 않고 메인 컨테이너와 함께 계속 실행됩니다.

```yaml
spec:
  initContainers:
  - name: log-shipper      # 네이티브 사이드카
    image: fluentd:v1.16
    restartPolicy: Always   # ← 이 설정이 핵심
    volumeMounts:
    - name: logs
      mountPath: /var/log/app

  containers:
  - name: app
    image: myapp:1.0
```

네이티브 사이드카의 장점:

- **시작 순서 보장**: 사이드카가 준비된 후 메인 컨테이너가 시작됩니다
- **Job 지원**: Job이 완료될 때 메인 컨테이너가 먼저 종료되고, 이후 사이드카도 종료됩니다
- **readinessProbe 지원**: 사이드카 준비 여부를 체크할 수 있습니다

기존 방식(containers 배열)에서는 Job에서 메인 컨테이너가 완료되어도 로그 사이드카가 남아 Job이 완료되지 않는 문제가 있었습니다. 네이티브 사이드카는 이 문제를 해결합니다.

## 어댑터 사이드카

레거시 애플리케이션이 Prometheus 형식이 아닌 다른 형식으로 메트릭을 노출할 때, 어댑터 사이드카가 형식을 변환합니다.

```yaml
- name: metrics-adapter
  image: prom/statsd-exporter:v0.26
  ports:
  - containerPort: 9102    # Prometheus 형식으로 노출
  args:
  - --statsd.listen-udp=:9125
  - --web.listen-address=:9102
```

이 방식으로 레거시 앱을 수정하지 않고 Prometheus 모니터링 시스템과 통합할 수 있습니다.

---

**지난 글:** [쿠버네티스 Init Container — 메인 컨테이너 시작 전 준비 작업](/posts/k8s-init-containers/)

**다음 글:** [Liveness · Readiness · Startup Probe — 자가 치유와 트래픽 제어](/posts/k8s-probes-liveness-readiness/)

<br>
읽어주셔서 감사합니다. 😊
