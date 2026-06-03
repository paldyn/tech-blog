---
title: "쿠버네티스 KEDA — 이벤트 기반 자동 스케일링"
description: "KEDA(Kubernetes Event-driven Autoscaling)의 아키텍처, ScaledObject·ScaledJob 설정, Scale-to-Zero 동작, 다양한 이벤트 소스 연동 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "KEDA", "이벤트 기반 스케일링", "Scale-to-Zero", "SQS", "Kafka", "자동 스케일링"]
featured: false
draft: false
---

[지난 글](/posts/k8s-hpa-custom-external-metrics/)에서 HPA의 외부 메트릭 연동을 살펴봤습니다. 외부 메트릭 어댑터를 직접 구축하는 것은 복잡하고 유지보수 부담이 큽니다. KEDA는 이 문제를 해결하는 **이벤트 기반 자동 스케일링** 프레임워크입니다.

## KEDA란?

KEDA(Kubernetes Event-driven Autoscaling)는 Microsoft와 Red Hat이 공동 개발한 CNCF 프로젝트입니다. 핵심 특징은 두 가지입니다.

첫째, **Scale-to-Zero**: 이벤트가 없을 때 Pod를 0개로 줄여 비용을 아낄 수 있습니다. 일반 HPA는 `minReplicas: 1`이 최솟값이지만, KEDA는 진짜 0으로 내릴 수 있습니다.

둘째, **50개 이상의 내장 스케일러**: SQS, Kafka, RabbitMQ, Redis, Prometheus, CloudWatch, GitHub Actions 등을 플러그인 방식으로 지원합니다. 각 소스별로 어댑터를 따로 구축할 필요가 없습니다.

## KEDA 아키텍처

![KEDA 아키텍처](/assets/posts/k8s-keda-architecture.svg)

KEDA는 두 개의 핵심 컴포넌트로 구성됩니다. **Operator**는 `ScaledObject` 리소스를 감시하고, 정의된 트리거에 맞춰 HPA를 자동으로 생성·관리합니다. **Metrics Server**는 `external.metrics.k8s.io` API를 구현해 이벤트 소스의 메트릭을 HPA에 제공합니다.

## ScaledObject 설정

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-processor-scaler
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-processor
  pollingInterval: 30        # 30초마다 이벤트 소스 확인
  cooldownPeriod: 300        # 이벤트 소진 후 300초 뒤 0으로 축소
  minReplicaCount: 0         # 0으로 스케일 다운 허용
  maxReplicaCount: 50
  triggers:
  - type: aws-sqs-queue
    authenticationRef:
      name: keda-trigger-auth-aws
    metadata:
      queueURL: "https://sqs.ap-northeast-2.amazonaws.com/123456789/orders"
      queueLength: "10"      # 큐 메시지 10개당 Pod 1개
      awsRegion: "ap-northeast-2"
```

`queueLength: "10"`은 목표 메시지 수입니다. 큐에 100개 메시지가 있으면 `ceil(100/10) = 10`개 Pod로 스케일 업합니다.

## Scale-to-Zero 동작 원리

![KEDA Scale-to-Zero 흐름](/assets/posts/k8s-keda-scale-to-zero.svg)

이벤트가 없으면 KEDA는 HPA를 통해 Deployment를 0 replicas로 줄입니다. 새 이벤트가 감지되면 KEDA가 먼저 `minReplicaCount`나 1개로 Deployment를 복원한 뒤 HPA가 인계받아 필요한 수로 스케일 업합니다.

`cooldownPeriod`는 이벤트가 소진된 뒤 0으로 줄이기까지 대기하는 시간입니다. 짧으면 비용 절감이 크지만, 다음 이벤트 도착 시 콜드 스타트 지연이 발생합니다. 워크로드 특성에 따라 조절하세요.

## Kafka 스케일러 예제

```yaml
triggers:
- type: kafka
  metadata:
    bootstrapServers: kafka.default.svc.cluster.local:9092
    consumerGroup: order-consumer
    topic: orders
    lagThreshold: "50"      # 컨슈머 랙 50개당 Pod 1개
    offsetResetPolicy: latest
```

Kafka는 컨슈머 랙(lag)을 기준으로 스케일링합니다. 랙이 500이면 `ceil(500/50) = 10`개 Pod를 생성합니다.

## TriggerAuthentication — 인증 정보 분리

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: keda-trigger-auth-aws
spec:
  secretTargetRef:
  - parameter: awsAccessKeyID
    name: aws-credentials
    key: AWS_ACCESS_KEY_ID
  - parameter: awsSecretAccessKey
    name: aws-credentials
    key: AWS_SECRET_ACCESS_KEY
```

인증 정보를 ScaledObject에 직접 넣지 않고 `TriggerAuthentication`으로 분리합니다. IRSA(IAM Roles for Service Accounts)나 Workload Identity를 사용하면 Secret 없이도 운영할 수 있습니다.

## ScaledJob — 배치 처리에 최적화

`ScaledObject`가 Deployment의 replicas를 조정하는 반면, `ScaledJob`은 이벤트 하나당 Job 하나를 생성합니다.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata:
  name: image-processor
spec:
  jobTargetRef:
    template:
      spec:
        containers:
        - name: processor
          image: processor:latest
  triggers:
  - type: aws-sqs-queue
    metadata:
      queueURL: "..."
      queueLength: "1"    # 메시지 1개 = Job 1개
```

이미지 처리, 보고서 생성처럼 각 항목이 독립적인 배치 작업에 적합합니다.

---

**지난 글:** [쿠버네티스 HPA 커스텀·외부 메트릭 — Prometheus Adapter와 외부 메트릭 연동](/posts/k8s-hpa-custom-external-metrics/)

**다음 글:** [쿠버네티스 VPA — Pod 수직 자동 스케일링](/posts/k8s-vertical-pod-autoscaler/)

<br>
읽어주셔서 감사합니다. 😊
