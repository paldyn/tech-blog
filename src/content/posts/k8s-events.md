---
title: "Kubernetes Events — 클러스터의 블랙박스 기록"
description: "Kubernetes Event 오브젝트의 생성 주체와 구조, kubectl events·describe로 조회하는 방법, 자주 만나는 Warning reason 카탈로그, 1시간 TTL의 함정과 이벤트 익스포터를 통한 영구 보존, 이벤트 기반 알림 구성까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["Events", "트러블슈팅", "kubectl", "event-exporter", "관측성", "TTL", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-tracing-opentelemetry/)까지 메트릭·로그·트레이스라는 관측성 3종 세트를 구축했다. 그런데 이 외부 도구들이 보지 못하는 사각지대가 하나 있다. 파드가 아예 시작도 못 했다면? 앱 로그는 한 줄도 없고, 메트릭도 트레이스도 없다. 이때 유일한 단서가 Kubernetes가 스스로 남기는 1차 기록, **Event**다. 컨트롤러들이 "내가 방금 무엇을 했고 무엇에 실패했는지"를 적어두는 클러스터의 블랙박스인 셈이다.

## Event는 누가 만드는가

Event는 특별한 시스템이 아니라 **일반 Kubernetes 오브젝트**다. Pod나 Deployment처럼 API Server를 통해 생성되고 etcd에 저장된다. 차이라면 만드는 주체가 사용자가 아니라 컨트롤러들이라는 점이다.

![Event는 누가 만들고 어디로 가는가](/assets/posts/k8s-events-flow.svg)

- **Scheduler**: 파드를 배치하지 못하면 `FailedScheduling`을 남긴다
- **kubelet**: 이미지 풀(`Pulling`/`Pulled`), 컨테이너 시작·종료(`Started`/`Killing`), 프로브 실패(`Unhealthy`)를 남긴다
- **Controller Manager**: ReplicaSet 스케일링(`ScalingReplicaSet`) 등 워크로드 조정 기록을 남긴다
- **HPA, 기타 컨트롤러**: 오토스케일 결정(`SuccessfulRescale`) 등을 남긴다

즉 "파드 하나가 뜨기까지의 모든 인프라 레벨 사연"이 Event로 남는다. 앱 로그가 시작되기 *이전*의 일들 — 스케줄링, 이미지 풀, 볼륨 마운트 — 은 오직 여기에만 기록된다.

## 조회하는 법

가장 익숙한 진입점은 `kubectl describe`다. 출력 맨 아래 Events 섹션이 해당 오브젝트와 관련된 이벤트 목록이다.

```bash
kubectl describe pod api-7d9c6bf5c4-x2k8p
# ...
# Events:
#   Type     Reason            Age    From               Message
#   ----     ------            ----   ----               -------
#   Warning  FailedScheduling  2m     default-scheduler  0/5 nodes are available:
#                                                        insufficient memory.
```

이벤트만 모아 보려면 전용 명령 `kubectl events`가 낫다 (1.23+에서 `kubectl get events`보다 정렬·필터가 편하다).

```bash
# 네임스페이스의 최근 이벤트 — 시간순
kubectl events -n prod

# Warning만 필터
kubectl events --types=Warning -A

# 특정 오브젝트 관련 이벤트만
kubectl events --for pod/api-7d9c6bf5c4-x2k8p

# 실시간 감시 (배포 직후 모니터링에 유용)
kubectl events -n prod --watch
```

배포 직후 `kubectl events --watch`를 켜두는 습관은 단순하지만 강력하다. 롤링 업데이트 중 발생하는 프로브 실패, 이미지 풀 오류가 실시간으로 흘러간다.

## Event 오브젝트 해부

![Event 오브젝트 해부](/assets/posts/k8s-events-anatomy.svg)

필드 구조를 알면 필터링과 자동화가 쉬워진다.

- **type**: `Normal`(정보성)과 `Warning`(문제) 둘뿐이다. 모니터링 대상은 사실상 Warning이다
- **reason**: `BackOff`, `FailedMount` 같은 기계 판독용 카테고리. 알림 규칙의 키가 된다
- **involvedObject**: 이벤트의 주인공(어느 파드/노드에 대한 것인가)
- **message**: 사람이 읽는 상세 설명
- **count / series**: 같은 이벤트가 반복되면 새 오브젝트를 만들지 않고 횟수만 올린다 — etcd를 보호하는 집계 장치다

자주 만나는 Warning reason은 외워둘 가치가 있다. `FailedScheduling`(배치할 노드 없음), `BackOff`(재시작 백오프), `Unhealthy`(프로브 실패), `FailedMount`(볼륨 마운트 실패), `FailedCreatePodSandBox`(네트워크/런타임 문제). 이 다섯 개면 파드 기동 문제의 대부분을 분류할 수 있다.

## 함정: 1시간이면 사라진다

Event에는 치명적인 제약이 있다. API Server의 `--event-ttl` 기본값이 **1시간**이라는 것이다. 이벤트가 etcd 부하의 주범이 되는 것을 막기 위한 설계지만, 운영자 입장에서는 "새벽 3시 장애의 이벤트가 아침 출근길엔 이미 없다"는 뜻이다.

TTL을 늘리는 것은 etcd 용량 문제 때문에 권장되지 않는다. 정석은 **이벤트를 외부로 내보내 영구 보존**하는 것이다.

```bash
# kubernetes-event-exporter 설치
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install event-exporter bitnami/kubernetes-event-exporter \
  -n monitoring
```

```yaml
# event-exporter 설정 — 라우팅 규칙
config:
  logLevel: info
  route:
    routes:
      # 모든 이벤트를 Loki로 (영구 보존 + LogQL 검색)
      - match:
          - receiver: loki
      # Warning은 Slack으로도
      - match:
          - type: Warning
            receiver: slack
  receivers:
    - name: loki
      loki:
        url: http://loki-gateway.logging/loki/api/v1/push
    - name: slack
      slack:
        webhook: https://hooks.slack.com/services/...
        channel: "#k8s-alerts"
```

이렇게 하면 이벤트가 Loki에 로그처럼 쌓여 `{job="event-exporter"} | json | reason="FailedScheduling"` 같은 LogQL로 과거 어떤 시점이든 검색할 수 있다. [지난 글](/posts/k8s-logging-efk-loki/)에서 만든 로깅 파이프라인이 이벤트 보존소 역할까지 겸하는 것이다.

## 이벤트 기반 알림과 메트릭

이벤트를 메트릭으로 바꿔 Prometheus 알림에 태우는 방법도 있다. kube-state-metrics는 이벤트 자체를 다루지 않지만, kubelet과 컨트롤러의 행동 결과는 결국 오브젝트 상태로 반영되므로 `kube_pod_container_status_waiting_reason` 같은 메트릭이 사실상 같은 신호를 준다. 빈도 기반 판단("최근 10분간 FailedScheduling이 5회 이상")이 필요하면 event-exporter → Loki 경로에서 LogQL 메트릭 쿼리로 알림을 만든다.

```logql
# 분당 FailedScheduling 이벤트 수
sum(count_over_time({app="event-exporter"}
  | json | reason="FailedScheduling" [5m]))
```

알림 채널 설계의 원칙은 단순하다. **개별 Warning 이벤트를 그대로 Slack에 다 쏘지 말 것.** 롤링 업데이트 한 번에도 Warning은 수십 개 발생한다. reason 화이트리스트(예: `FailedScheduling`, `OOMKilling`, `NodeNotReady`)와 빈도 조건을 걸어 신호 대 잡음비를 지켜야 한다.

## 트러블슈팅 루틴에 이벤트 넣기

이벤트를 활용하는 가장 좋은 방법은 트러블슈팅 순서에 박아 넣는 것이다.

```bash
# 1. 파드가 이상하다 → 로그보다 먼저 describe
kubectl describe pod <pod> | tail -20

# 2. 네임스페이스 전체가 이상하다 → Warning 이벤트 스캔
kubectl events -n prod --types=Warning

# 3. 클러스터 전체 점검 → 노드 이벤트 포함 전체 스캔
kubectl events -A --types=Warning | grep -v Unhealthy
```

"로그를 봤는데 아무것도 없다"는 상황의 답은 거의 항상 이벤트에 있다. 파드가 Pending이면 스케줄러의 사정이, ContainerCreating에서 멈췄으면 이미지나 볼륨의 사정이 이벤트로 적혀 있다.

## 마무리

Event는 화려한 도구는 아니지만, 컨트롤 플레인이 무엇을 했는지 보여주는 가장 정직한 기록이다. 핵심은 세 가지 — Warning 위주로 보고, describe의 Events 섹션을 첫 번째 단서로 삼고, 1시간 TTL을 익스포터로 보완하라. 그런데 Event가 "컨트롤러가 무엇을 했는가"의 기록이라면, "**누가** API에 무엇을 요청했는가"의 기록은 따로 있다. 다음 글에서는 보안과 컴플라이언스의 핵심인 **감사 로그(Audit Log)** 를 다룬다.

---

**지난 글:** [OpenTelemetry로 구현하는 Kubernetes 분산 트레이싱](/posts/k8s-tracing-opentelemetry/)

**다음 글:** [Kubernetes 감사 로그(Audit Log) — 누가 무엇을 했는가](/posts/k8s-audit-logs/)

<br>
읽어주셔서 감사합니다. 😊
