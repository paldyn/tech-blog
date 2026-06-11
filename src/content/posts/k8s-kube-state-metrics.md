---
title: "kube-state-metrics — Kubernetes 오브젝트 상태 메트릭"
description: "kube-state-metrics의 역할과 동작 원리, metrics-server와의 차이, kube_pod_status_phase 같은 핵심 메트릭과 라벨 조인 패턴, 실무 알림 규칙 예시, 대규모 클러스터에서의 카디널리티 관리와 샤딩 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["kube-state-metrics", "모니터링", "Prometheus", "PromQL", "메트릭", "알림", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-grafana-dashboards/)에서 Grafana로 메트릭을 시각화했다. 그런데 임포트한 대시보드의 쿼리를 들여다보면 `kube_deployment_status_replicas`, `kube_pod_status_phase` 같은 `kube_` 접두사 메트릭이 유난히 많다. 이 메트릭들은 Prometheus가 직접 만드는 것이 아니다. **kube-state-metrics**라는 별도 컴포넌트가 공급한다. 이번 글에서는 Kubernetes 모니터링의 숨은 주역인 kube-state-metrics를 깊이 들여다본다.

## kube-state-metrics는 무엇을 하는가

kube-state-metrics(이하 KSM)는 한 문장으로 요약하면 **"API Server의 오브젝트 상태를 Prometheus 메트릭으로 변환하는 어댑터"** 다.

![kube-state-metrics 동작 원리](/assets/posts/k8s-kube-state-metrics-arch.svg)

동작 방식은 단순하다.

1. API Server에 watch를 걸어 Deployment, Pod, Node, Job, PVC 등 오브젝트의 변경을 실시간으로 받는다
2. 각 오브젝트의 `spec`과 `status` 필드를 메트릭으로 변환해 메모리에 보관한다
3. `:8080/metrics` 엔드포인트로 노출하고, Prometheus가 주기적으로 스크랩한다

KSM 자신은 아무것도 저장하지 않는 stateless 컴포넌트다. 히스토리 축적은 전적으로 Prometheus TSDB의 몫이다.

```bash
# kube-prometheus-stack에 기본 포함되어 있다
kubectl get deploy -n monitoring | grep kube-state-metrics

# 노출되는 메트릭 직접 확인
kubectl port-forward -n monitoring svc/kube-prometheus-stack-kube-state-metrics 8080
curl -s localhost:8080/metrics | grep kube_deployment_spec_replicas | head -3
```

## metrics-server와 헷갈리지 말 것

이름이 비슷해서 자주 혼동되지만 두 컴포넌트는 완전히 다른 질문에 답한다.

![metrics-server vs kube-state-metrics](/assets/posts/k8s-kube-state-metrics-vs.svg)

- **metrics-server**: "이 파드가 지금 CPU를 얼마나 쓰는가" — kubelet에서 사용량을 모아 HPA와 `kubectl top`에 제공
- **kube-state-metrics**: "이 Deployment의 replicas가 spec과 일치하는가" — API 오브젝트의 상태를 Prometheus에 제공

metrics-server는 최신 값만 메모리에 들고 있고, KSM의 메트릭은 Prometheus에 시계열로 쌓여 "어제 새벽 3시에 파드가 몇 개였는가" 같은 질문에 답할 수 있다. 둘은 대체재가 아니라 상호 보완 관계이므로 실무 클러스터에는 둘 다 설치하는 것이 보통이다.

## 핵심 메트릭 카탈로그

전체 메트릭은 수백 개지만, 실무에서 80%는 아래 메트릭으로 해결된다.

```promql
# 워크로드 상태
kube_deployment_spec_replicas              # 원하는 replica 수
kube_deployment_status_replicas_available  # 실제 가용 replica 수
kube_pod_status_phase                      # Pending/Running/Failed...
kube_pod_container_status_restarts_total   # 컨테이너 재시작 횟수

# 컨테이너 대기 사유 (CrashLoopBackOff 탐지의 핵심)
kube_pod_container_status_waiting_reason

# 노드 상태
kube_node_status_condition                 # Ready, DiskPressure...
kube_node_spec_unschedulable               # cordon 여부

# 리소스 정의값 (사용량 아님!)
kube_pod_container_resource_requests
kube_pod_container_resource_limits

# Job / CronJob
kube_job_status_failed
kube_cronjob_status_last_schedule_time
```

주의할 점은 `kube_pod_container_resource_requests`가 **실제 사용량이 아니라 매니페스트에 선언된 requests 값**이라는 것이다. 사용량은 cAdvisor의 `container_cpu_usage_seconds_total`에서 온다. 이 둘을 나누면 "선언 대비 실사용률"이라는 비용 최적화의 핵심 지표가 나온다.

## 라벨 조인 패턴

KSM 메트릭의 진가는 **다른 메트릭과 조인할 때** 드러난다. 예를 들어 cAdvisor 메트릭에는 파드를 소유한 Deployment 정보가 없다. KSM의 정보성 메트릭(값이 항상 1인 `*_info`, `*_labels` 메트릭)을 조인해 보강할 수 있다.

```promql
# 파드별 CPU 사용량에 소유 워크로드 정보 붙이기
sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace, pod)
* on (namespace, pod) group_left(owner_name)
  kube_pod_owner{owner_kind="ReplicaSet"}
```

`group_left(owner_name)`는 왼쪽(사용량) 시계열에 오른쪽(KSM)의 `owner_name` 라벨을 가져와 붙인다. 팀 라벨로 비용을 배분하거나, Deployment 단위로 사용량을 집계할 때 반드시 쓰게 되는 패턴이다.

## 실무 알림 규칙 예시

KSM 메트릭은 알림 규칙의 주재료다. 대표적인 규칙 세 가지를 PrometheusRule로 정의해 보자.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: workload-state-alerts
  namespace: monitoring
spec:
  groups:
    - name: workload.state
      rules:
        - alert: KubePodCrashLooping
          expr: |
            max_over_time(kube_pod_container_status_waiting_reason{
              reason="CrashLoopBackOff"}[5m]) >= 1
          for: 10m
          labels:
            severity: warning

        - alert: KubeDeploymentReplicasMismatch
          expr: |
            kube_deployment_spec_replicas
              != kube_deployment_status_replicas_available
          for: 15m
          labels:
            severity: warning

        - alert: KubeNodeNotReady
          expr: |
            kube_node_status_condition{
              condition="Ready", status="true"} == 0
          for: 5m
          labels:
            severity: critical
```

`for` 절은 일시적인 흔들림(롤링 업데이트 중 replica 불일치 등)을 걸러내는 안전장치다. 특히 `KubeDeploymentReplicasMismatch`는 `for: 15m` 정도를 주지 않으면 배포할 때마다 알림이 울리는 양치기 소년이 된다.

## 카디널리티 — KSM의 어두운 면

KSM은 **오브젝트 수 × 라벨 조합**만큼 시계열을 만든다. 파드 1만 개 클러스터라면 `kube_pod_status_phase` 하나만 해도 파드당 5개 phase, 5만 시계열이다. Prometheus 메모리가 폭발하는 흔한 원인 중 하나가 KSM이다.

대응 수단은 두 가지다.

```yaml
# 1. 수집 리소스 화이트리스트 (Helm values)
kube-state-metrics:
  collectors:
    - deployments
    - pods
    - nodes
    - jobs
  # secrets, configmaps 등 불필요한 리소스 제외

  # 2. 라벨 화이트리스트 — kube_pod_labels로 노출할 라벨 제한
  extraArgs:
    - --metric-labels-allowlist=pods=[team,app]
```

특히 `--metric-labels-allowlist`를 지정하지 않은 채 `kube_pod_labels`를 쓰면 파드에 붙은 모든 라벨이 메트릭 라벨로 풀려 카디널리티가 통제 불능이 된다. 필요한 라벨만 명시적으로 허용하자.

## 대규모 클러스터: 수평 샤딩

오브젝트가 수십만 개인 클러스터에서는 KSM 단일 인스턴스가 병목이 된다. KSM은 오브젝트 UID 해시 기반 **수평 샤딩**을 지원한다.

```yaml
# StatefulSet으로 배포하면 파드 순번이 곧 샤드 번호
kube-state-metrics:
  replicas: 3
  autosharding:
    enabled: true
```

`autosharding`을 켜면 각 인스턴스가 전체 오브젝트의 1/N만 감시·노출하므로 메모리와 응답 크기가 분산된다. 수천 노드 미만 클러스터에서는 필요 없지만, 이런 옵션이 존재한다는 것을 알아두면 스케일 한계에 부딪혔을 때 당황하지 않는다.

## 마무리

kube-state-metrics는 "클러스터가 선언된 상태대로 돌고 있는가"라는 Kubernetes의 근본 질문을 메트릭으로 바꿔주는 컴포넌트다. 사용량(metrics-server, cAdvisor)과 상태(KSM)의 구분, 라벨 조인 패턴, 카디널리티 관리 — 이 세 가지만 잡아도 Kubernetes 모니터링의 골격이 선다. 메트릭은 이제 충분히 다뤘으니, 다음 글에서는 관측성의 두 번째 기둥인 **로깅**으로 넘어간다. Kubernetes에서 로그가 어디에 어떻게 쌓이는지부터 차근차근 살펴보자.

---

**지난 글:** [Grafana 대시보드 — Kubernetes 메트릭 시각화](/posts/k8s-grafana-dashboards/)

**다음 글:** [Kubernetes 로깅 아키텍처 — 관측성의 첫걸음](/posts/k8s-observability-logging/)

<br>
읽어주셔서 감사합니다. 😊
