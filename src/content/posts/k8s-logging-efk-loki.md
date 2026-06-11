---
title: "EFK 스택과 Loki — 중앙집중식 로깅 구축"
description: "Elasticsearch·Fluent Bit·Kibana로 구성하는 EFK 스택과 Grafana Loki의 아키텍처 차이, 전문 인덱싱과 라벨 인덱싱의 트레이드오프, Helm 기반 설치 방법, LogQL 핵심 문법, 운영 비용 관점에서의 선택 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["Loki", "EFK", "Elasticsearch", "FluentBit", "LogQL", "로깅", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-observability-logging/)에서 노드 로컬 로그는 휘발성이며 DaemonSet 에이전트로 중앙 저장소에 모아야 한다는 결론에 도달했다. 그렇다면 중앙 저장소는 무엇으로 할까? 이 영역의 양대 산맥이 전통의 **EFK 스택**(Elasticsearch + Fluent Bit + Kibana)과 Grafana 진영의 **Loki**다. 두 스택은 "로그를 어떻게 인덱싱할 것인가"에 대한 철학이 정반대라서, 차이를 이해하면 선택이 쉬워진다.

## EFK 스택 — 모든 것을 인덱싱한다

EFK는 수집(Fluent Bit) → 저장·검색(Elasticsearch) → 시각화(Kibana)로 역할이 나뉜다. 원래 EFK의 F는 Fluentd였지만, 요즘은 메모리 사용량이 수십 분의 일인 경량 구현체 Fluent Bit이 수집기 표준이다.

![EFK 스택 로그 파이프라인](/assets/posts/k8s-logging-efk-loki-efk.svg)

Elasticsearch의 핵심은 **전문(full-text) 인덱싱**이다. 로그 한 줄이 들어오면 본문을 토큰으로 쪼개 역인덱스를 만든다. 덕분에 "지난주 전체 로그에서 `connection refused`가 포함된 줄"을 어떤 사전 조건 없이도 빠르게 찾을 수 있다.

대가는 무게다. 모든 단어를 인덱싱하므로 인덱스가 원본 로그만큼 커지기도 하고, JVM 힙 튜닝·샤드 배치·ILM(인덱스 수명 주기) 관리라는 운영 숙제가 따라온다. Elasticsearch는 StatefulSet으로 배포되며 빠른 디스크(PV)를 많이 요구한다.

```bash
# ECK(Elastic Cloud on Kubernetes) Operator 방식 설치
helm repo add elastic https://helm.elastic.co
helm install elastic-operator elastic/eck-operator \
  -n elastic-system --create-namespace
```

```yaml
# Elasticsearch 클러스터 선언 (ECK CRD)
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: logging
  namespace: logging
spec:
  version: 8.17.0
  nodeSets:
    - name: default
      count: 3
      volumeClaimTemplates:
        - metadata:
            name: elasticsearch-data
          spec:
            resources:
              requests:
                storage: 200Gi
            storageClassName: fast-ssd
```

Fluent Bit은 지난 글에서 본 DaemonSet 패턴 그대로 배포하고, 출력 플러그인만 Elasticsearch로 지정한다.

```ini
# fluent-bit.conf의 출력 설정
[OUTPUT]
    Name            es
    Match           kube.*
    Host            logging-es-http.logging
    Port            9200
    Logstash_Format On
    Logstash_Prefix k8s-logs
    Suppress_Type_Name On
```

## Loki — 라벨만 인덱싱한다

Loki의 설계 철학은 "Prometheus, but for logs"다. Prometheus가 메트릭을 라벨로 식별하듯, Loki는 로그 스트림을 `{namespace="prod", app="api"}` 같은 **라벨 조합으로만 인덱싱**하고, 본문은 압축된 청크로 오브젝트 스토리지(S3, GCS)에 던져 넣는다.

![Loki 아키텍처 — 라벨만 인덱싱한다](/assets/posts/k8s-logging-efk-loki-loki.svg)

본문을 인덱싱하지 않으니 인덱스가 극단적으로 작고, 저장소는 가장 싼 오브젝트 스토리지를 쓴다. 검색은 "라벨로 스트림을 좁힌 뒤, 그 범위를 그 자리에서 grep"하는 방식이다. 범위를 잘 좁히면 충분히 빠르지만, 라벨 없이 전체 기간을 전문 검색하는 작업은 Elasticsearch보다 느리다.

설치는 Helm 차트 하나로 끝난다. 소규모라면 단일 바이너리 모드, 그 이상은 읽기/쓰기를 분리한 Simple Scalable 모드를 쓴다.

```bash
helm repo add grafana https://grafana.github.io/helm-charts

# Loki (Simple Scalable 모드 + S3 백엔드)
helm install loki grafana/loki -n logging --create-namespace \
  --set loki.storage.type=s3 \
  --set loki.storage.bucketNames.chunks=my-loki-chunks

# 수집기 Alloy (Promtail 후속) — DaemonSet
helm install alloy grafana/alloy -n logging
```

수집기 쪽에서 주의할 점은 **라벨 카디널리티**다. Loki의 인덱스는 라벨 조합 수만큼 커지므로, `trace_id`나 `user_id`처럼 값이 무한히 늘어나는 필드를 라벨로 만들면 Loki의 존재 이유가 무너진다. 라벨은 `namespace`, `app`, `pod` 수준으로 유지하고 나머지는 본문 필터로 거른다.

## LogQL 빠르게 익히기

Loki의 쿼리 언어 LogQL은 PromQL과 닮아서 Prometheus를 쓰던 팀이라면 진입 장벽이 낮다. 구조는 "스트림 셀렉터 + 파이프라인"이다.

```logql
# 1. 라벨로 스트림 선택 후 본문 필터
{namespace="prod", app="api"} |= "error" != "healthcheck"

# 2. JSON 파싱 후 필드 조건
{app="api"} | json | level="error" and status >= 500

# 3. 메트릭화 — 분당 에러 로그 수 (PromQL처럼!)
sum(rate({app="api"} |= "error" [5m])) by (pod)

# 4. 라인 포맷으로 출력 가공
{app="api"} | json | line_format "{{.method}} {{.path}} {{.status}}"
```

특히 3번처럼 **로그를 즉석에서 메트릭으로 변환**하는 기능이 강력하다. "에러 로그 비율이 5분간 1% 초과" 같은 알림 규칙을 로그 기반으로 만들 수 있고, Grafana 한 화면에서 메트릭 패널과 로그 패널을 나란히 두고 같은 시간축으로 탐색할 수 있다. 지난 글에서 구조화 로깅(JSON)을 강조한 이유가 여기서 드러난다 — `| json` 한 단계면 모든 필드가 쿼리 가능해진다.

## 무엇을 선택할 것인가

선택 기준을 운영 관점에서 정리하면 다음과 같다.

| 기준 | EFK | Loki |
|---|---|---|
| 인덱싱 | 전문(모든 토큰) | 라벨만 |
| 저장 비용 | 높음 (인덱스 + 빠른 디스크) | 낮음 (오브젝트 스토리지) |
| 운영 난이도 | 높음 (JVM, 샤드, ILM) | 낮음~중간 |
| 자유 전문 검색 | 매우 빠름 | 범위를 좁혀야 빠름 |
| 메트릭 연계 | 별도 도구 | Grafana에서 통합 |
| 어울리는 곳 | 검색 중심 조직, 보안 분석 | Prometheus/Grafana 기반 팀 |

실무 감각으로 요약하면 이렇다. **이미 Prometheus + Grafana를 쓰고 있고 로그의 주 용도가 트러블슈팅이라면 Loki가 기본값**이다. 비용과 운영 부담이 작고, 메트릭→로그로 넘어가는 탐색 동선이 매끄럽다. 반면 전사 로그 분석 플랫폼, 감사·보안 이벤트 검색처럼 임의 키워드 검색이 핵심 요구라면 Elasticsearch의 전문 인덱스가 여전히 강하다. 두 스택을 함께 운영하며 용도를 나누는 조직도 드물지 않다.

## 보존 정책은 처음부터

어느 쪽을 선택하든 **보존(retention) 정책 없이 운영을 시작하면 안 된다**. 로그는 무조건 쌓이고, 디스크나 S3 비용 청구서는 반드시 돌아온다.

```yaml
# Loki 보존 설정 — 30일 후 삭제
loki:
  limits_config:
    retention_period: 720h
  compactor:
    retention_enabled: true
    delete_request_store: s3
```

Elasticsearch는 ILM 정책으로 hot(7일, SSD) → warm(30일) → delete 단계를 정의하는 것이 정석이다. "전체 30일, 중요 네임스페이스만 90일"처럼 테넌트별 차등을 두면 비용을 크게 아낄 수 있다.

## 마무리

EFK와 Loki의 차이는 결국 인덱싱 철학의 차이다. 모든 것을 인덱싱해 검색 자유도를 사는 EFK, 라벨만 인덱싱해 비용과 단순함을 사는 Loki. 어느 쪽이든 수집은 DaemonSet 에이전트, 앱은 stdout + JSON이라는 기본기는 동일하다. 이제 관측성의 세 기둥 중 메트릭과 로그를 갖췄다. 다음 글에서는 마지막 기둥 — 요청이 여러 서비스를 넘나드는 경로를 추적하는 **분산 트레이싱과 OpenTelemetry**를 다룬다.

---

**지난 글:** [Kubernetes 로깅 아키텍처 — 관측성의 첫걸음](/posts/k8s-observability-logging/)

**다음 글:** [OpenTelemetry로 구현하는 Kubernetes 분산 트레이싱](/posts/k8s-tracing-opentelemetry/)

<br>
읽어주셔서 감사합니다. 😊
