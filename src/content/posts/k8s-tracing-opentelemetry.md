---
title: "OpenTelemetry로 구현하는 Kubernetes 분산 트레이싱"
description: "트레이스와 스팬의 개념, 컨텍스트 전파 원리, OpenTelemetry Collector의 receivers·processors·exporters 파이프라인, OTel Operator의 자동 계측, Tempo 백엔드 연동, 샘플링 전략까지 Kubernetes 분산 트레이싱의 전체 그림을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["OpenTelemetry", "분산트레이싱", "Tempo", "Jaeger", "관측성", "OTLP", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-logging-efk-loki/)에서 로그 파이프라인을 완성했다. 그런데 마이크로서비스 환경에서는 메트릭과 로그만으로 답하기 어려운 질문이 있다. "이 주문 요청은 왜 3초나 걸렸는가?" 요청이 게이트웨이 → 주문 → 결제 → DB를 거치는 동안 각 서비스의 로그는 따로 흩어져 있고, 메트릭은 평균만 말해준다. 이 질문에 답하는 도구가 관측성의 세 번째 기둥, **분산 트레이싱**이고, 그 표준이 **OpenTelemetry(OTel)** 다.

## 트레이스와 스팬

분산 트레이싱의 데이터 모델은 두 개념으로 끝난다.

- **트레이스(Trace)**: 하나의 요청이 시스템을 통과하는 전체 여정. 고유한 `trace_id`로 식별된다
- **스팬(Span)**: 여정 속 개별 작업 구간(HTTP 핸들러, DB 쿼리 등). 시작/종료 시각과 부모 스팬 ID를 가진다

![하나의 요청, 하나의 트레이스, 여러 스팬](/assets/posts/k8s-tracing-opentelemetry-trace.svg)

트레이싱 UI에서 보는 워터폴은 스팬들의 부모-자식 트리를 시간축에 펼친 것이다. 위 그림처럼 전체 320ms 중 payment 스팬이 230ms를 차지한다면 병목이 어디인지 즉시 보인다. 메트릭이 "느리다"를, 로그가 "에러 메시지"를 알려준다면, 트레이스는 **"어느 구간에서 왜"** 를 알려준다.

여기서 핵심 기술이 **컨텍스트 전파(context propagation)** 다. 서비스 A가 B를 호출할 때 `trace_id`와 부모 `span_id`를 HTTP 헤더(W3C 표준 `traceparent`)에 실어 보내야 B의 스팬이 같은 트레이스에 연결된다.

```http
GET /api/payment HTTP/1.1
traceparent: 00-a1b2c3d4e5f6...-00f067aa0ba902b7-01
```

이 헤더를 모든 서비스가 일관되게 읽고·만들고·전달하게 하는 것이 계측(instrumentation)의 본질이고, 그 표준 도구가 OpenTelemetry다.

## OpenTelemetry — 계측의 사실상 표준

OTel 이전에는 Jaeger 클라이언트, Zipkin 클라이언트 등 백엔드마다 SDK가 달랐다. OpenTelemetry는 **계측 API/SDK, 전송 프로토콜(OTLP), 수집기(Collector)** 를 벤더 중립으로 통일했다. 앱은 OTel SDK로 한 번만 계측하면, 백엔드는 Tempo든 Jaeger든 상용 APM이든 설정만 바꿔 갈아탈 수 있다.

Kubernetes에서는 **OTel Operator**를 쓰면 코드 수정 없이 자동 계측까지 가능하다.

```bash
# OTel Operator 설치 (cert-manager 필요)
helm repo add open-telemetry \
  https://open-telemetry.github.io/opentelemetry-helm-charts
helm install otel-operator open-telemetry/opentelemetry-operator \
  -n otel --create-namespace
```

```yaml
# 자동 계측 정의 — 언어 런타임에 에이전트 주입
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: default-instrumentation
  namespace: prod
spec:
  exporter:
    endpoint: http://otel-collector.otel:4317
  propagators:
    - tracecontext
    - baggage
  sampler:
    type: parentbased_traceidratio
    argument: "0.1"
```

그다음 파드에 어노테이션 하나만 붙이면 Operator가 init 컨테이너로 자바 에이전트(또는 Python/Node.js 계측기)를 주입한다.

```yaml
# Deployment의 파드 템플릿에 추가
metadata:
  annotations:
    instrumentation.opentelemetry.io/inject-java: "true"
```

Spring Boot 앱이라면 이 한 줄로 HTTP 서버/클라이언트, JDBC, Kafka 호출에 스팬이 자동으로 생기고 `traceparent` 전파까지 처리된다. 자동 계측으로 시작하고, 비즈니스적으로 중요한 구간(예: "쿠폰 적용 로직")만 수동 스팬을 추가하는 것이 실무 순서다.

## OTel Collector — 텔레메트리의 허브

앱이 백엔드로 데이터를 직접 쏘게 할 수도 있지만, 중간에 **Collector**를 두는 것이 표준 아키텍처다.

![OpenTelemetry Collector 파이프라인](/assets/posts/k8s-tracing-opentelemetry-collector.svg)

Collector 파이프라인은 receivers → processors → exporters 세 단계로 구성된다.

```yaml
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel-collector
  namespace: otel
spec:
  mode: deployment        # 또는 daemonset (agent 모드)
  config:
    receivers:
      otlp:
        protocols:
          grpc: {}
          http: {}

    processors:
      batch: {}
      k8sattributes: {}    # 파드명·네임스페이스 등 자동 부착
      memory_limiter:
        limit_percentage: 80
        check_interval: 1s

    exporters:
      otlp/tempo:
        endpoint: tempo.tracing:4317
        tls:
          insecure: true

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, k8sattributes, batch]
          exporters: [otlp/tempo]
```

`k8sattributes` 프로세서가 특히 중요하다. 스팬에 `k8s.pod.name`, `k8s.namespace.name` 같은 리소스 속성을 자동으로 붙여, 트레이스에서 "이 느린 스팬이 어느 파드에서 나왔는가"를 바로 알 수 있게 한다. 배포 모드는 노드마다 두는 DaemonSet(agent)과 중앙 Deployment(gateway)를 조합하는 2계층 구성이 대규모 클러스터의 정석이다.

## 백엔드: Tempo

트레이스 저장소로는 Jaeger와 Grafana Tempo가 대표적이다. 이 시리즈처럼 Grafana/Loki 스택을 쓰고 있다면 Tempo가 자연스럽다 — Loki와 같은 철학(최소 인덱스 + 오브젝트 스토리지)이라 운영 비용이 낮고, Grafana에서 메트릭·로그·트레이스가 한 화면에 모인다.

```bash
helm install tempo grafana/tempo -n tracing --create-namespace \
  --set tempo.storage.trace.backend=s3 \
  --set tempo.storage.trace.s3.bucket=my-tempo-traces
```

진짜 강력한 것은 **세 신호의 연결**이다. 지난 글에서 구조화 로그에 `trace_id` 필드를 남기라고 한 이유가 여기 있다.

- 로그 → 트레이스: Grafana에서 Loki 로그의 `trace_id`를 클릭하면 Tempo의 해당 트레이스로 점프
- 트레이스 → 로그: 스팬을 보다가 "이 시점 이 파드의 로그"로 점프
- 메트릭 → 트레이스: 히스토그램에서 느린 요청의 예시 트레이스(exemplar)로 점프

장애 분석 동선이 "대시보드에서 이상 감지 → 느린 트레이스 확인 → 해당 스팬의 로그 확인"으로 클릭 몇 번에 끝난다.

## 샘플링 — 전부 저장하지 않는다

초당 수만 요청을 모두 트레이싱하면 저장 비용이 감당이 안 된다. 그래서 샘플링이 필수다.

- **Head 샘플링**: 요청 시작 시점에 확률로 결정(위 예시의 `traceidratio 0.1` = 10%). 단순하고 저렴하지만 "에러 난 요청"을 놓칠 수 있다
- **Tail 샘플링**: Collector가 트레이스를 끝까지 모아본 뒤 "에러가 있거나 1초 이상 걸린 것만 저장" 같은 정책으로 결정. 가치 있는 트레이스만 남지만 Collector 메모리가 필요하다

```yaml
# tail_sampling 프로세서 — 에러와 느린 요청은 전부 보존
processors:
  tail_sampling:
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 1000 }
      - name: baseline
        type: probabilistic
        probabilistic: { sampling_percentage: 5 }
```

시작은 head 샘플링 10%면 충분하다. 트래픽이 커지고 "장애 때 트레이스가 없네"를 한 번 겪으면 그때 tail 샘플링을 도입하자.

## 마무리

이로써 관측성의 세 기둥 — 메트릭(Prometheus/Grafana), 로그(Loki/EFK), 트레이스(OTel/Tempo) — 가 모두 갖춰졌다. 핵심은 도구가 아니라 연결이다. `trace_id`를 고리로 세 신호를 잇는 순간, 장애 분석 시간이 한 자릿수로 줄어든다. 그런데 Kubernetes에는 외부 도구 없이도 클러스터가 스스로 남기는 1차 관측 데이터가 있다. 다음 글에서는 종종 잊히지만 트러블슈팅의 첫 단서가 되는 **Kubernetes Events**를 파헤친다.

---

**지난 글:** [EFK 스택과 Loki — 중앙집중식 로깅 구축](/posts/k8s-logging-efk-loki/)

**다음 글:** [Kubernetes Events — 클러스터의 블랙박스 기록](/posts/k8s-events/)

<br>
읽어주셔서 감사합니다. 😊
