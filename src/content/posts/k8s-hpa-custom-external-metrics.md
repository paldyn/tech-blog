---
title: "쿠버네티스 HPA 커스텀·외부 메트릭 — Prometheus Adapter와 외부 메트릭 연동"
description: "Kubernetes HPA에서 Prometheus Adapter를 이용한 커스텀 메트릭(HTTP RPS 등)과 SQS·CloudWatch 같은 외부 메트릭으로 스케일링하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "HPA", "커스텀 메트릭", "Prometheus Adapter", "External Metrics", "SQS", "자동 스케일링"]
featured: false
draft: false
---

[지난 글](/posts/k8s-horizontal-pod-autoscaler/)에서 CPU·메모리 기반 HPA를 다뤘습니다. 이번에는 **비즈니스 로직에 맞는 지표**인 HTTP RPS, 큐 메시지 수 같은 커스텀·외부 메트릭으로 스케일링하는 방법을 살펴봅니다.

## 세 가지 메트릭 소스

HPA는 `autoscaling/v2`에서 세 가지 메트릭 타입을 지원합니다.

| 타입 | API 그룹 | 예시 |
|---|---|---|
| Resource | metrics.k8s.io | CPU, 메모리 |
| Object/Pods | custom.metrics.k8s.io | HTTP RPS, 세션 수 |
| External | external.metrics.k8s.io | SQS 큐 길이, ALB RPS |

커스텀 메트릭을 사용하려면 Prometheus Adapter 같은 **메트릭 API 서버**를 클러스터에 배포해야 합니다. 외부 메트릭은 클러스터 외부 서비스의 데이터를 가져오는 어댑터가 필요합니다(KEDA가 이를 추상화합니다).

## Prometheus Adapter로 커스텀 메트릭 연동

![HPA 커스텀 메트릭 파이프라인](/assets/posts/k8s-hpa-custom-metrics-pipeline.svg)

Prometheus Adapter는 Prometheus의 메트릭을 `custom.metrics.k8s.io` API로 노출합니다. HPA는 이 API를 통해 메트릭 값을 조회합니다.

```yaml
# Prometheus Adapter values.yaml (Helm 설치)
rules:
  default: false    # 기본 CPU/메모리 규칙 비활성화
  custom:
  - seriesQuery: 'http_requests_total{namespace!="",pod!=""}'
    resources:
      overrides:
        namespace: {resource: namespace}
        pod: {resource: pod}
    name:
      as: "http_requests_per_second"
    metricsQuery: 'sum(rate(<<.Series>>[2m])) by (<<.GroupBy>>)'
```

설치 후 메트릭이 노출됐는지 확인합니다.

```bash
# 커스텀 메트릭 API 확인
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1" | jq .

# 특정 Pod의 메트릭 조회
kubectl get --raw \
  "/apis/custom.metrics.k8s.io/v1beta1/namespaces/default/pods/*/http_requests_per_second"
```

## HPA에 커스텀 메트릭 적용

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-server
  minReplicas: 2
  maxReplicas: 20
  metrics:
  # Pod당 RPS를 100으로 유지
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  # Ingress 전체 RPS 기반 (Object 타입)
  - type: Object
    object:
      metric:
        name: nginx_ingress_requests_per_second
      describedObject:
        apiVersion: networking.k8s.io/v1
        kind: Ingress
        name: web-ingress
      target:
        type: Value
        value: "1000"
```

`Pods` 타입은 각 Pod의 평균값을 사용하고, `Object` 타입은 특정 오브젝트(Ingress, Service 등) 하나의 값을 사용합니다.

## 외부 메트릭 — SQS 큐 기반 스케일링

![HPA External 메트릭 활용](/assets/posts/k8s-hpa-external-metrics.svg)

SQS 큐 메시지 수나 ALB의 요청 수 같은 외부 지표는 `External` 타입으로 설정합니다.

```yaml
metrics:
- type: External
  external:
    metric:
      name: sqs_messages_visible
      selector:
        matchLabels:
          queue: order-processor
    target:
      type: Value
      value: "30"    # 큐 메시지 30개당 Pod 1개 목표
```

하지만 외부 메트릭 어댑터를 직접 관리하는 것은 복잡합니다. 실무에서는 다음 글에서 다룰 **KEDA**를 사용하는 것이 일반적입니다. KEDA는 SQS, Kafka, Redis 등 다양한 이벤트 소스를 플러그인 방식으로 지원합니다.

## 다중 메트릭 사용 시 선택 규칙

HPA에 여러 메트릭을 지정하면, 각 메트릭이 계산한 desiredReplicas 중 **가장 큰 값**을 선택합니다. 즉 어느 하나라도 스케일 업 신호를 보내면 스케일 업합니다.

```bash
# 현재 HPA 메트릭 상태 확인
kubectl describe hpa web-hpa

# 메트릭 별 현재값 확인
# TARGETS: 120/100, 800/1000
# CPU 초과 → CPU 기준으로 스케일 업 결정
```

---

**지난 글:** [쿠버네티스 HPA — Pod 수평 자동 스케일링](/posts/k8s-horizontal-pod-autoscaler/)

**다음 글:** [쿠버네티스 KEDA — 이벤트 기반 자동 스케일링](/posts/k8s-keda-event-driven-autoscaling/)

<br>
읽어주셔서 감사합니다. 😊
