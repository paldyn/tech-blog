---
title: "Kubernetes 로깅 아키텍처 — 관측성의 첫걸음"
description: "컨테이너 로그가 노드의 어디에 어떻게 쌓이는지, kubectl logs의 동작 경로와 로그 로테이션, 노드 에이전트·사이드카·직접 전송이라는 3가지 수집 패턴의 장단점, 구조화 로깅 등 중앙집중식 로깅을 도입하기 전에 알아야 할 기초를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["로깅", "관측성", "kubectl-logs", "DaemonSet", "사이드카", "구조화로깅", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kube-state-metrics/)까지 메트릭 파이프라인을 완성했다. 메트릭은 "무언가 잘못됐다"를 알려주지만, "왜 잘못됐는가"에 답하려면 결국 로그를 봐야 한다. 그런데 Kubernetes에서 로그는 어디에 쌓일까? `kubectl logs`는 어떻게 동작하고, 파드가 죽으면 로그는 어떻게 될까? 중앙집중식 로깅 스택을 도입하기 전에 반드시 이해해야 할 Kubernetes 로깅의 기본 구조를 이번 글에서 정리한다.

## 컨테이너 로그의 여정

Kubernetes 로깅의 출발점은 단순한 약속이다. **컨테이너화된 앱은 로그를 파일이 아니라 stdout/stderr로 쓴다.** 그다음은 인프라가 알아서 한다.

![컨테이너 로그는 어디에 쌓이는가](/assets/posts/k8s-observability-logging-node.svg)

흐름을 따라가 보자.

1. 앱이 stdout/stderr로 로그를 출력한다
2. 컨테이너 런타임(containerd)이 이 스트림을 캡처해 노드의 파일로 기록한다
3. kubelet이 이 파일을 관리하고, `kubectl logs` 요청이 오면 읽어서 돌려준다

노드에 직접 들어가 확인해 보면 구조가 명확하다.

```bash
# 노드에서 — 파드별 로그 디렉터리
ls /var/log/pods/
# default_api-7d9c6bf5c4-x2k8p_3f1a.../

# 컨테이너별 로그 파일 (JSON 라인 형식)
cat /var/log/pods/default_api-*/app/0.log
# 2026-06-12T09:13:01.123Z stdout F {"level":"info","msg":"server started"}

# /var/log/containers/ 는 위 파일들의 심볼릭 링크 모음
ls -l /var/log/containers/ | head -3
```

`/var/log/containers/*.log`는 파일명에 파드명·네임스페이스·컨테이너명이 모두 들어 있는 심볼릭 링크다. 로그 수집 에이전트들이 이 경로를 tail 하면서 파일명에서 메타데이터를 뽑아내는 것이 노드 레벨 수집의 기본 원리다.

## kubectl logs의 동작 경로

`kubectl logs`는 의외로 긴 경로를 거친다. kubectl → API Server → 해당 노드의 kubelet → 로그 파일 읽기 → 역순으로 반환. 로그가 etcd나 API Server에 저장되는 것이 아니라, **매번 노드의 파일을 실시간으로 읽는다**는 점이 중요하다.

자주 쓰는 옵션을 정리하면:

```bash
# 직전 컨테이너(재시작 전)의 로그 — CrashLoop 디버깅 필수
kubectl logs api-7d9c6bf5c4-x2k8p --previous

# 실시간 스트리밍 + 최근 100줄부터
kubectl logs -f --tail=100 deploy/api

# 멀티 컨테이너 파드에서 특정 컨테이너
kubectl logs api-7d9c6bf5c4-x2k8p -c istio-proxy

# 라벨 셀렉터로 여러 파드 동시에
kubectl logs -l app=api --prefix --tail=20
```

`--previous`는 재시작된 컨테이너의 **직전 1개** 로그만 보여준다. 그보다 과거는 이미 사라졌다. 이것이 노드 로컬 로깅의 첫 번째 한계다.

## 로그 로테이션 — 디스크를 지키는 장치

로그를 무한정 쌓으면 노드 디스크가 가득 차고, DiskPressure로 파드가 쫓겨나는 사태가 벌어진다. kubelet은 컨테이너별 로그 크기를 제한한다.

```yaml
# kubelet 설정 (KubeletConfiguration)
containerLogMaxSize: 10Mi   # 파일 1개 최대 크기 (기본값)
containerLogMaxFiles: 5     # 로테이션 보관 개수 (기본값)
```

기본값 기준으로 컨테이너당 최대 50Mi만 보관된다. 트래픽이 많은 서비스라면 **몇 시간 치 로그만 남는다**는 뜻이다. `kubectl logs`로 어제 로그를 찾으려다 허탕 치는 이유가 바로 이것이다.

정리하면 노드 로컬 로그의 한계는 세 가지다.

- 파드가 삭제되면 로그도 함께 삭제된다
- 노드 장애 시 그 노드의 로그 전체에 접근할 수 없다
- 로테이션 때문에 보관 기간이 짧다

그래서 운영 클러스터에는 로그를 외부 저장소로 옮기는 **중앙집중식 수집**이 사실상 필수다.

## 수집 아키텍처 3가지 패턴

로그를 중앙으로 모으는 방법은 크게 세 가지다.

![로그 수집 아키텍처 3가지 패턴](/assets/posts/k8s-observability-logging-patterns.svg)

### ① 노드 에이전트 (DaemonSet) — 기본값

Fluent Bit, Promtail(Alloy), Vector 같은 수집기를 DaemonSet으로 배포해 노드마다 1개씩 띄우고, `/var/log/pods`를 통째로 tail 한다.

```yaml
# Fluent Bit DaemonSet의 핵심 — 호스트 로그 디렉터리 마운트
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: logging
spec:
  template:
    spec:
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:3.2
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
```

앱 수정이 전혀 필요 없고, 새로 배포되는 파드도 자동으로 수집 대상이 되며, 노드당 1개라 리소스 효율이 가장 좋다. 단점은 stdout/stderr 로그만 수집된다는 것 — 컨테이너 내부 파일에 로그를 쓰는 레거시 앱은 커버하지 못한다.

### ② 사이드카 — 보완 패턴

파일에만 로그를 쓰는 앱(예: 특정 상용 솔루션)을 어쩔 수 없이 돌려야 한다면, 파드에 로깅 컨테이너를 추가하고 emptyDir 볼륨을 공유시킨다. 사이드카가 파일을 tail 해서 stdout으로 흘리거나 백엔드로 직접 보낸다. 유연하지만 파드마다 컨테이너가 하나씩 늘어나는 비용을 치른다.

### ③ 직접 전송 — 특수한 경우만

앱이 로깅 라이브러리의 appender로 Elasticsearch 등에 직접 쏘는 방식이다. 인프라를 거치지 않아 자유도가 높지만, 앱과 로깅 백엔드가 강하게 결합되고 `kubectl logs`로는 아무것도 볼 수 없게 된다. 표준 패턴으로는 권장하지 않는다.

결론은 명확하다. **앱은 stdout으로만 쓰고, 수집은 노드 에이전트에 맡긴다.** 사이드카는 예외 상황의 보완 수단이다.

## 수집 전에 준비할 것 — 구조화 로깅

수집 파이프라인을 깔기 전에 앱 쪽에서 해야 할 준비가 하나 있다. **로그를 JSON으로 구조화**하는 것이다.

```json
{"ts":"2026-06-12T09:13:01Z","level":"error","logger":"payment",
 "msg":"charge failed","order_id":"ord-3921","trace_id":"a1b2c3"}
```

평문 로그는 백엔드에서 정규식 파싱이라는 깨지기 쉬운 단계를 강요한다. 처음부터 JSON으로 쓰면 수집기가 필드를 그대로 인덱싱하고, `level=error AND order_id=ord-3921` 같은 쿼리가 즉시 가능해진다. `trace_id` 필드를 함께 남겨두면 나중에 분산 트레이싱과 로그를 연결하는 다리가 된다 — 이 부분은 시리즈 뒷글에서 다시 만난다.

수집기는 여기에 Kubernetes 메타데이터(네임스페이스, 파드명, 라벨)를 자동으로 덧붙인다. "어떤 코드가"(앱 필드) + "어디서 돌다가"(K8s 메타데이터) 문제를 일으켰는지가 한 레코드에 담기는 것이다.

## 마무리

Kubernetes 로깅의 뼈대를 요약하면 이렇다. 앱은 stdout으로 쓰고, 런타임이 `/var/log/pods`에 기록하며, kubelet이 로테이션과 `kubectl logs` 제공을 책임진다. 그리고 이 노드 로컬 로그는 휘발성이므로 DaemonSet 에이전트로 중앙 저장소에 옮겨야 한다. 그렇다면 그 "중앙 저장소"로는 무엇을 쓸까? 다음 글에서 전통의 EFK 스택과 라벨 기반의 경량 대안 Loki를 비교하며 실제 구축 방법을 살펴본다.

---

**지난 글:** [kube-state-metrics — Kubernetes 오브젝트 상태 메트릭](/posts/k8s-kube-state-metrics/)

**다음 글:** [EFK 스택과 Loki — 중앙집중식 로깅 구축](/posts/k8s-logging-efk-loki/)

<br>
읽어주셔서 감사합니다. 😊
