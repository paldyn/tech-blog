---
title: "운영자가 스위치처럼 켜는 관측성 — opt-in 디자인 노트"
description: "self-hosted 제품에 PLG + Tempo + Grafana 5종 관측성 스택을 도입하면서 한 디자인 결정들. 자원 부담 회피를 위한 docker-compose profiles + 트레이싱은 별도 override + 코드 0줄 수정 OTel agent."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 2
type: "record"
category: "Infra"
tags: ["observability", "prometheus", "loki", "grafana", "tempo", "opentelemetry", "docker-compose"]
featured: false
draft: false
---

self-hosted 제품에 관측성 스택을 처음 깔 때 가장 먼저 부딪치는 질문은
"무엇을 켤 것인가" 가 아니라 "**누가 언제 켤 것인가**" 였다. 운영자가
필요할 때 스위치 하나로 켜고, 끄면 자원이 0으로 돌아오는 구조.
docker-compose `profiles` + 트레이싱 별도 override + OTel java agent
조합으로 그 그림을 그렸다.

---

## 상황 / 배경

- Mebrix = 자체호스팅 (on-prem) 데이터 모델링 / 데이터사전 / ERD / DB
  워크벤치 통합 플랫폼. 6개 레포, 5개 서비스 (Spring Boot 4 + nginx 1)
- 폐쇄망 고객 가능성 큼 → **외부 SaaS (Datadog 등) 의존 X**
- 단일 docker-compose 호스트가 표준 deploy → 평소엔 자원 작게 유지하고
  싶음
- 현재 가시성: stdout 로그뿐. 메트릭 0, 트레이스 0, 대시보드 0

목표:
1. **Logs / Metrics / Traces 3대 신호 모두**
2. **운영자 opt-in** — 기본 비활성, 켜면 풀스택, 끄면 자원 0
3. **코드 변경 최소** — Java API 들에 instrumentation 코드 추가 X

---

## 결정 1 — PLG + Tempo + Grafana (5 컨테이너)

후보:
- **A. PLG (Promtail+Loki+Grafana) + Prometheus + Tempo** — self-hosted
- **B. OpenTelemetry collector + Datadog/Honeycomb** — SaaS 백엔드
- **C. Spring Boot Actuator metrics + 구조화 로그만** — 최소

**A 채택**. 이유: 폐쇄망 호환 (B 탈락), 풀스택 가시성 필요 (C 탈락).
디스크/메모리 부담은 운영자 opt-in 으로 흡수.

![관측성 스택 — opt-in 아키텍처. 평소엔 안 뜨고 필요할 때만 +5 컨테이너](/assets/posts/observability-opt-in-architecture.svg)

---

## 결정 2 — `docker-compose profiles` 로 opt-in

기본 비활성, `.env` 한 줄로 활성:

```yaml
# bundle-template/docker-compose.yml.tpl
services:
  prometheus:
    profiles: ["observability"]   # ← 평소엔 안 뜸
    image: prom/prometheus:v2.55.0
    # ...

  loki:
    profiles: ["observability"]
    image: grafana/loki:3.2.1
    # ...

  promtail:
    profiles: ["observability"]
    image: grafana/promtail:3.2.1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    # docker_sd_configs filter: label "mebrix.observe=true"

  tempo:
    profiles: ["observability"]
    image: grafana/tempo:2.6.1
    # ...

  grafana:
    profiles: ["observability"]
    image: grafana/grafana:11.3.0
    ports: ["${GRAFANA_PORT:-3000}:3000"]
    # ...

  # 4개 Java API 에는 라벨만 추가
  auth-api:
    labels:
      mebrix.observe: "true"      # ← Promtail 이 이걸 보고 수집
```

운영자는 평소엔 없는 셈. 활성화는:

```bash
# .env
COMPOSE_PROFILES=observability
GRAFANA_ADMIN_PASSWORD=<강력한_비번>
```

```bash
docker compose up -d   # 5개 컨테이너 추가 기동, ~700MB RAM 추가
```

끄려면 `.env` 의 그 줄 지우고 `docker compose up -d` — 5개 컨테이너 사라짐.

---

## 결정 3 — Java side, 코드 수정 0

메트릭은 Spring Boot Actuator + Micrometer 한 줄로:

```groovy
// build.gradle (4개 Java API 동일)
implementation 'org.springframework.boot:spring-boot-starter-actuator'
implementation 'io.micrometer:micrometer-registry-prometheus'
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,prometheus
  endpoint:
    health:
      show-details: never        # 정보 누설 방지
      probes:
        enabled: true             # liveness / readiness
  metrics:
    tags:
      application: ${spring.application.name}
```

`SecurityConfig` 에서 인증 우회만 추가:

```java
.requestMatchers(
    "/actuator/health",
    "/actuator/health/**",
    "/actuator/prometheus"
).permitAll()
```

이걸로 자동 노출되는 메트릭:
- `http_server_requests_seconds_*` — Tomcat 자동 (rate / p95 / error rate)
- `jvm_memory_*` / `jvm_gc_*` — JVM 상태
- `hikaricp_connections_*` — DB 풀
- `process_uptime_seconds` 등

비즈 메트릭은 직접 추가 가능 — 우리는 PG↔SQLite 미러 drift 같은 건 별도
gauge 등록:

```java
meterRegistry.gauge("mebrix_dict_mirror_drift",
    Tags.of("table", name), holder, AtomicLong::doubleValue);
```

---

## 결정 4 — 트레이싱은 추가 override 로 분리

트레이싱은 코드 변경 0 으로 가능하지만, **모든 Java 컨테이너에 OTel
agent 마운트 + JAVA_TOOL_OPTIONS 설정** 이 필요. 이건 docker-compose
의 `profiles` 로는 표현 안 됨 (profile 이 service 자체를 on/off 하는
용도이지 service 안 필드를 조건부로 못 함).

해법: **override 파일 분리**.

![관측성 — 3단계 opt-in 사다리. 기본 / +로그메트릭 / +트레이싱](/assets/posts/observability-tracing-override.svg)

```yaml
# observability/docker-compose.tracing.yml
services:
  auth-api:
    volumes:
      - ./observability/otel-javaagent.jar:/agent.jar:ro
    environment:
      JAVA_TOOL_OPTIONS: "-javaagent:/agent.jar"
      OTEL_SERVICE_NAME: mb-auth-api
      OTEL_EXPORTER_OTLP_ENDPOINT: http://tempo:4318
      OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
      OTEL_TRACES_EXPORTER: otlp
      OTEL_METRICS_EXPORTER: none
      OTEL_LOGS_EXPORTER: none
  dict-api:
    # 동일 패턴
  erd-api:
    # 동일 패턴
  dbwb-api:
    # 동일 패턴
```

활성화는 `.env` 의 `COMPOSE_FILE` 변수 한 줄 추가:

```bash
# Linux / macOS
COMPOSE_FILE=docker-compose.yml:observability/docker-compose.tracing.yml

# Windows (PowerShell — 구분자가 ; 라 주의)
COMPOSE_FILE=docker-compose.yml;observability/docker-compose.tracing.yml
```

OTel agent JAR 은 **워크플로우 빌드 시점에 다운로드해 번들에 포함**.

```yaml
# .github/workflows/propagate-tags.yml
- name: Build online bundle
  env:
    OTEL_AGENT_VERSION: 2.10.0
  run: |
    cp -R bundle-template/. "$WORK_DIR/"
    curl -fL -o "${WORK_DIR}/observability/otel-javaagent.jar" \
      "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar"
```

agent 가 자동 instrument 하는 것:
- Spring Web controller (HTTP request span)
- JDBC / HikariCP (DB query span)
- HTTP client (RestTemplate / WebClient / OkHttp)
- 컨트롤러 → 서비스 → repository 깊이 자동 추적

**Java 코드 0줄 수정**.

---

## 결정 5 — Loki ↔ Tempo 자동 연결

Grafana 데이터소스 자동 프로비저닝 시 Loki 의 `derivedFields` 로 trace
ID 패턴 매칭:

```yaml
# observability/grafana/provisioning/datasources/all.yml
- name: Loki
  type: loki
  url: http://loki:3100
  jsonData:
    derivedFields:
      - datasourceUid: tempo
        matcherRegex: 'trace_id=([a-f0-9]+)'
        name: TraceID
        url: '$${__value.raw}'
```

로그에 `trace_id=abc123...` 이 보이면 Grafana UI 가 자동으로 클릭 가능
링크로 만들어줌 → Tempo 데이터소스의 trace 워터폴로 점프.

Tempo 쪽도 양방향:

```yaml
- name: Tempo
  jsonData:
    tracesToLogsV2:
      datasourceUid: loki
      spanStartTimeShift: -1m
      spanEndTimeShift: 1m
      filterByTraceID: true
    serviceMap:
      datasourceUid: prometheus
    nodeGraph:
      enabled: true
```

trace → logs / metrics / service map 자동 생성.

---

## 결정 6 — 대시보드 자동 로딩

`observability/grafana/dashboards/` 에 JSON 떨구면 Grafana 가 30s 마다
폴링해서 자동 인식.

```yaml
# observability/grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
  - name: Mebrix
    folder: Mebrix
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

기본 2종 번들 포함:
- **Mebrix Overview** — service up/down, HTTP rate / error / p95 latency,
  JVM heap, HikariCP, 최근 ERROR 로그
- **Mebrix Operations** — 로그인 / 429 차단 / 5xx / 401·403, PG↔SQLite
  drift 테이블별, auto-recovery 누적, alerts, GC pause, 전체 ERROR 로그

운영자가 추가 대시보드 원하면 같은 디렉토리에 JSON 만 던져넣음 — 30s 후
자동 인식.

커뮤니티 대시보드 (예: ID 4701 JVM Micrometer) 는 Grafana UI Import 로
권장.

---

## 결과

| 지표 | 도입 전 | 도입 후 (활성 시) |
|---|---|---|
| 로그 검색 | `docker compose logs` grep | LogQL 쿼리 (`{service="auth-api"} \|~ "ERROR"`) |
| 메트릭 | 없음 | Prometheus 30일 보존, Mebrix Overview 대시보드 |
| 트레이스 | 없음 | Tempo, Loki 로그 클릭 → 워터폴 점프 |
| Java 코드 변경 | — | **0줄** |
| 운영자 활성화 비용 | — | `.env` 1~2줄 + `docker compose up -d` |
| 비활성 시 자원 | — | **0** (5개 컨테이너 미기동) |
| 활성 시 RAM | — | ~700MB+ |
| 활성 시 디스크 | — | Loki/Prometheus/Tempo 30일 (보통 수 GB/월) |

운영자 입장의 결정 트리:

```
관측성 필요?
├─ 아니오 → 그대로. 자원 0.
└─ 예
    ├─ 메트릭 + 로그만? → COMPOSE_PROFILES=observability
    └─ 트레이스도 → 위에 더해 COMPOSE_FILE override
```

---

## 앞으로 어떻게 할 것인가

- **알람 (Grafana Alerting) baseline 자동 프로비저닝**: 현재는 README
  에 PromQL 6종을 룰 형태로 적어두고 운영자가 UI 에서 등록. 알림 채널
  이 운영 정책 의존이라 자동화 어려움. Grafana 의 `provisioning/alerting`
  yaml 파일로 무알림 채널 룰만 자동 등록 + 채널 연결만 운영자에게.
- **OTel agent 버전 자동 추적**: 워크플로우의 `OTEL_AGENT_VERSION: 2.10.0`
  하드코딩. Dependabot 으로 못 잡음 (action 도 docker 도 npm 도 아님).
  자체 watcher 또는 정기 점검.
- **트레이싱 sampling 조정 옵션**: 현재 100%. 트래픽 많아지면 head
  sampling 으로 비율 조정 필요. `OTEL_TRACES_SAMPLER` 환경변수 노출.
- **PostgreSQL exporter 추가**: 현재 PG 메트릭 (커넥션 / 쿼리 통계 / 디스크
  사용량) 미수집. `prometheus-postgres-exporter` 컨테이너 추가 시 가능.
  자원 ↑ 이라 옵션화 필요.

---

## 회고 한 줄

> 풀스택 관측성을 깔되 운영자가 켤지 말지 결정하게 두자. opt-in 디자인은
> "기능 X 와 자원 0" 사이의 trade-off 를 운영자에게 위임하는 가장 솔직한
> 방법이다.

<br>
읽어주셔서 감사합니다. 😊
