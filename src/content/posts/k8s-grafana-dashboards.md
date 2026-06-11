---
title: "Grafana 대시보드 — Kubernetes 메트릭 시각화"
description: "Grafana의 데이터 소스와 대시보드 구조, kube-prometheus-stack 환경에서의 데이터 소스 프로비저닝, 커뮤니티 대시보드 임포트, 변수를 활용한 동적 대시보드 구성, 사이드카 기반 ConfigMap 프로비저닝으로 대시보드를 코드로 관리하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["Grafana", "대시보드", "모니터링", "Prometheus", "시각화", "Provisioning", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-prometheus/)에서 Prometheus로 클러스터 메트릭을 수집하고 PromQL로 쿼리하는 방법을 다뤘다. 하지만 PromQL 쿼리 결과를 매번 텍스트로 확인하는 것은 비효율적이다. 이번 글에서는 수집된 메트릭을 시각화하는 표준 도구인 **Grafana**를 살펴본다. 대시보드의 구조부터 변수 활용, 그리고 대시보드를 코드로 관리하는 프로비저닝 패턴까지 실무에서 바로 쓸 수 있는 내용을 정리한다.

## Grafana의 위치

Grafana는 자체적으로 데이터를 저장하지 않는다. Prometheus, Loki, Tempo, Elasticsearch, CloudWatch 같은 외부 저장소에 쿼리를 보내고, 결과를 패널로 렌더링하는 **시각화 레이어**다. 이 분리 덕분에 메트릭·로그·트레이스를 하나의 대시보드에서 함께 볼 수 있다.

![Grafana 대시보드 아키텍처](/assets/posts/k8s-grafana-dashboards-arch.svg)

핵심 개념은 세 가지다.

- **데이터 소스(Data Source)**: Grafana가 쿼리를 보낼 백엔드. Prometheus가 가장 흔하다
- **패널(Panel)**: 하나의 쿼리 결과를 그리는 단위. Time series, Gauge, Stat, Table 등
- **대시보드(Dashboard)**: 패널의 모음. 내부적으로는 하나의 JSON 문서로 표현된다

[지난 글](/posts/k8s-prometheus/)에서 설치한 kube-prometheus-stack을 사용했다면 Grafana는 이미 함께 배포되어 있다.

```bash
# Grafana 서비스 확인
kubectl get svc -n monitoring | grep grafana

# 로컬에서 접속 (기본 계정: admin / prom-operator)
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
```

브라우저에서 `http://localhost:3000`에 접속하면 기본 대시보드 수십 개가 이미 로드되어 있는 것을 확인할 수 있다.

## 데이터 소스 프로비저닝

UI에서 데이터 소스를 클릭으로 추가할 수도 있지만, Kubernetes 환경에서는 **프로비저닝(Provisioning)** 방식이 표준이다. YAML 파일로 데이터 소스를 선언하면 Grafana가 시작할 때 자동으로 등록한다.

```yaml
# datasources.yaml — 프로비저닝 파일
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://kube-prometheus-stack-prometheus.monitoring:9090
    isDefault: true
    jsonData:
      timeInterval: 30s

  - name: Loki
    type: loki
    access: proxy
    url: http://loki-gateway.logging:80
```

kube-prometheus-stack은 Prometheus 데이터 소스를 자동으로 프로비저닝해 준다. 추가 데이터 소스는 Helm values에서 선언한다.

```yaml
# kube-prometheus-stack values.yaml
grafana:
  additionalDataSources:
    - name: Loki
      type: loki
      url: http://loki-gateway.logging:80
```

`access: proxy`는 브라우저가 아닌 Grafana 서버가 데이터 소스에 쿼리를 대신 보내는 방식이다. 클러스터 내부 서비스 DNS(`서비스명.네임스페이스`)를 그대로 쓸 수 있어 Kubernetes에서는 거의 항상 proxy 모드를 사용한다.

## 패널과 PromQL

대시보드의 최소 단위인 패널은 "쿼리 + 시각화 옵션"의 조합이다. 자주 쓰는 패널 패턴을 보자.

```promql
# 네임스페이스별 CPU 사용량 (Time series 패널)
sum(rate(container_cpu_usage_seconds_total{namespace!=""}[5m]))
  by (namespace)

# 노드 메모리 사용률 (Gauge 패널)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# 현재 Running 파드 수 (Stat 패널)
sum(kube_pod_status_phase{phase="Running"})
```

패널 설정에서 중요한 것은 **단위(Unit)와 임계값(Threshold)** 지정이다. CPU는 `cores`, 메모리는 `bytes(IEC)`, 비율은 `percent(0-100)` 단위를 명시해야 축이 올바르게 표시된다. Gauge나 Stat 패널에는 임계값 색상(예: 80% 이상 빨강)을 지정해 한눈에 이상 여부를 파악할 수 있게 한다.

## 변수로 동적 대시보드 만들기

네임스페이스가 30개인 클러스터에서 네임스페이스마다 대시보드를 복사하는 것은 최악의 패턴이다. **변수(Variable)** 를 사용하면 하나의 대시보드를 드롭다운으로 전환할 수 있다.

대시보드 설정 → Variables에서 Query 타입 변수를 추가한다.

```promql
# 변수 $namespace — 라벨 값 목록을 동적으로 조회
label_values(kube_pod_info, namespace)

# 변수 $pod — 선택된 네임스페이스에 종속 (체이닝)
label_values(kube_pod_info{namespace="$namespace"}, pod)
```

패널 쿼리에서는 변수를 그대로 참조한다.

```promql
sum(rate(container_cpu_usage_seconds_total{
  namespace="$namespace", pod=~"$pod"
}[5m])) by (pod)
```

`pod=~"$pod"`처럼 정규식 매칭(`=~`)을 쓰면 변수의 Multi-value 옵션(여러 파드 동시 선택)과 All 옵션을 지원할 수 있다. 변수 체이닝과 Multi-value 조합만 익혀도 대시보드 수를 수십 분의 일로 줄일 수 있다.

## 커뮤니티 대시보드 임포트

바닥부터 만들 필요는 없다. [grafana.com/dashboards](https://grafana.com/grafana/dashboards/)에는 검증된 커뮤니티 대시보드가 수천 개 있다. 대시보드 ID만 알면 바로 임포트할 수 있다.

| ID | 대시보드 | 용도 |
|---|---|---|
| 315 | Kubernetes cluster monitoring | 클러스터 전체 현황 |
| 1860 | Node Exporter Full | 노드 상세 메트릭 |
| 13332 | kube-state-metrics v2 | 오브젝트 상태 |
| 14584 | CoreDNS | DNS 성능 |

Dashboards → New → Import에서 ID를 입력하고 데이터 소스만 매핑하면 끝이다. 단, 임포트한 대시보드는 출발점으로 삼고 팀에 맞게 다듬어서 사용하는 것이 좋다. 패널이 100개씩 있는 대시보드는 보기엔 화려하지만 장애 상황에서는 오히려 노이즈가 된다.

## 대시보드를 코드로 — 사이드카 프로비저닝

UI에서 대시보드를 수정하면 그 변경은 Grafana 내부 DB(SQLite)에만 저장된다. Grafana 파드가 재생성되면 사라질 수 있고, 누가 무엇을 바꿨는지 추적도 안 된다. 실무 표준은 **대시보드 JSON을 ConfigMap으로 만들어 Git으로 관리**하는 것이다.

kube-prometheus-stack의 Grafana에는 `k8s-sidecar`라는 사이드카 컨테이너가 함께 배포된다. 이 사이드카는 특정 라벨이 붙은 ConfigMap을 클러스터 전체에서 감시하다가, 발견하면 JSON 내용을 공유 볼륨에 떨어뜨리고 Grafana가 이를 자동 로드한다.

![사이드카 기반 대시보드 프로비저닝](/assets/posts/k8s-grafana-dashboards-sidecar.svg)

대시보드 ConfigMap은 이렇게 만든다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"   # 사이드카가 감시하는 라벨
data:
  api-dashboard.json: |
    {
      "title": "API Server Overview",
      "panels": [ ... ]
    }
```

워크플로는 다음과 같다.

1. UI에서 대시보드를 만들고 다듬는다 (탐색 단계)
2. 대시보드 설정 → JSON Model에서 JSON을 복사한다
3. ConfigMap으로 감싸 Git 저장소에 커밋한다
4. CI/CD 또는 GitOps 도구가 `kubectl apply` → 사이드카가 자동 반영

```bash
# 적용 후 사이드카 로그로 반영 확인
kubectl logs -n monitoring deploy/kube-prometheus-stack-grafana \
  -c grafana-sc-dashboard | tail -5
```

이 패턴의 장점은 명확하다. 대시보드 변경이 코드 리뷰를 거치고, 클러스터를 새로 만들어도 대시보드가 함께 복원되며, UI 수동 편집으로 인한 환경 간 드리프트가 사라진다.

## 알림(Alerting)은 어디서?

Grafana에도 자체 Alerting 기능이 있지만, kube-prometheus-stack 환경이라면 알림 규칙은 PrometheusRule(AlertManager)로 일원화하는 것을 권장한다. Grafana Alerting까지 함께 쓰면 알림 규칙이 두 곳에 흩어져 운영 부담이 커진다. Grafana는 시각화에 집중시키고, 알림 파이프라인은 Prometheus 생태계에 맡기는 분리가 깔끔하다.

## 마무리

Grafana는 데이터 소스 위에 얹는 시각화 레이어이고, 대시보드는 결국 JSON 문서다. 이 사실을 이해하면 "대시보드도 코드처럼 관리한다"는 운영 원칙이 자연스럽게 따라온다. 데이터 소스는 Helm values로, 대시보드는 라벨 붙은 ConfigMap으로 선언하고 Git에서 버전 관리하자. 다음 글에서는 기본 대시보드들이 의존하는 핵심 컴포넌트, 오브젝트 상태 메트릭의 공급원인 **kube-state-metrics**를 깊이 들여다본다.

---

**지난 글:** [Prometheus — Kubernetes 모니터링 기초](/posts/k8s-prometheus/)

**다음 글:** [kube-state-metrics — Kubernetes 오브젝트 상태 메트릭](/posts/k8s-kube-state-metrics/)

<br>
읽어주셔서 감사합니다. 😊
