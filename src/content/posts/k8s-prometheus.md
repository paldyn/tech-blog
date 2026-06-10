---
title: "Prometheus — Kubernetes 모니터링 기초"
description: "kube-prometheus-stack Helm 차트로 Prometheus 설치, ServiceMonitor와 PodMonitor로 스크랩 대상 설정, PrometheusRule로 알림 규칙 정의, 핵심 PromQL 쿼리 패턴, Grafana 대시보드 연동을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["Prometheus", "모니터링", "PromQL", "Grafana", "AlertManager", "ServiceMonitor", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-metrics-server/)에서 Kubernetes Metrics Server를 다뤘다. 이번 글에서는 Kubernetes 생태계 표준 모니터링 스택인 **Prometheus**를 살펴본다. Metrics Server가 최신 리소스 사용량만 제공한다면, Prometheus는 장기 시계열 데이터 저장, 복잡한 쿼리, 알림까지 지원하는 풀스택 모니터링 솔루션이다.

## Prometheus의 역할

Prometheus는 Pull 방식으로 메트릭을 수집한다. 스크랩 대상(애플리케이션, kubelet, kube-state-metrics)이 `/metrics` HTTP 엔드포인트를 노출하면, Prometheus가 정기적으로 해당 엔드포인트를 수집(scrape)해 TSDB(Time Series Database)에 저장한다.

![Prometheus Kubernetes 모니터링 아키텍처](/assets/posts/k8s-prometheus-arch.svg)

## kube-prometheus-stack으로 한 번에 설치

`kube-prometheus-stack`은 Prometheus, AlertManager, Grafana와 Kubernetes 기본 모니터링 규칙을 포함하는 Helm 차트다.

```bash
# Helm 레포 추가
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# kube-prometheus-stack 설치
helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=admin123 \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=fast-ssd \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi

# 설치 확인
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

## ServiceMonitor로 앱 메트릭 스크랩

`ServiceMonitor`는 Prometheus Operator의 CRD로, 어떤 Service를 스크랩할지 선언적으로 정의한다.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
  namespace: monitoring
  labels:
    release: kube-prometheus-stack   # Prometheus selector와 일치해야 함
spec:
  namespaceSelector:
    matchNames:
      - production
  selector:
    matchLabels:
      app: myapp
  endpoints:
    - port: http-metrics              # Service의 포트 이름
      path: /metrics
      interval: 15s
      scrapeTimeout: 10s
```

```yaml
# 애플리케이션 Service에 매칭 레이블 추가
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: production
  labels:
    app: myapp           # ServiceMonitor selector와 일치
spec:
  ports:
    - name: http-metrics  # ServiceMonitor endpoint port와 일치
      port: 8080
```

## PrometheusRule로 알림 규칙 정의

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: myapp-alerts
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: myapp.rules
      interval: 30s
      rules:
        # 알림 규칙
        - alert: HighErrorRate
          expr: |
            sum(rate(http_requests_total{status=~"5..",namespace="production"}[5m]))
            / sum(rate(http_requests_total{namespace="production"}[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "5xx 에러율 5% 초과"
            description: "{{ $labels.namespace }}/{{ $labels.pod }} 에러율: {{ $value | humanizePercentage }}"

        # 기록 규칙 (Recording Rule)
        - record: job:http_requests:rate5m
          expr: sum(rate(http_requests_total[5m])) by (job)
```

Recording Rule은 자주 사용하는 복잡한 쿼리를 미리 계산해 저장한다. 대시보드나 알림에서 재사용할 때 성능이 크게 향상된다.

## 핵심 PromQL 쿼리 패턴

![PromQL 핵심 쿼리 패턴](/assets/posts/k8s-prometheus-promql.svg)

```promql
# 노드별 디스크 사용률 (%)
100 * (1 - node_filesystem_avail_bytes{fstype!="tmpfs"}
       / node_filesystem_size_bytes{fstype!="tmpfs"})

# Deployment의 원하는 replicas vs 실제 ready replicas
kube_deployment_status_replicas_ready
/ kube_deployment_spec_replicas

# OOMKilled된 컨테이너 (지난 1시간)
increase(kube_pod_container_status_restarts_total[1h]) > 0
and on(pod, container)
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"} == 1
```

PromQL의 `rate()`, `increase()`, `histogram_quantile()`, `topk()`, `by`/`without` 레이블 집계를 이해하면 대부분의 모니터링 요구사항을 표현할 수 있다.

## Grafana 대시보드 접근

```bash
# Grafana 포트 포워딩
kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring

# 기본 자격증명: admin / admin123 (설치 시 지정한 값)
# http://localhost:3000
```

kube-prometheus-stack은 설치 시 다수의 기본 대시보드를 제공한다. `Kubernetes / Compute Resources / Cluster`, `Kubernetes / Nodes`, `Kubernetes / Pods` 대시보드에서 클러스터 전체 현황을 즉시 확인할 수 있다. 커스텀 애플리케이션 메트릭은 PromQL 패널을 추가해 커스텀 대시보드를 만들거나, Grafana.com에서 커뮤니티 대시보드(dashboard.json ID)를 임포트해 사용한다.

---

**지난 글:** [Metrics Server — 클러스터 리소스 메트릭 수집](/posts/k8s-metrics-server/)

<br>
읽어주셔서 감사합니다. 😊
