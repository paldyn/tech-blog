---
title: "OOMKilled — 메모리 한도를 넘어 강제 종료될 때"
description: "컨테이너가 메모리 limit을 초과해 커널 OOM Killer에게 SIGKILL(137)당하는 OOMKilled를 다룹니다. request와 limit의 차이, OOM의 경계선이 왜 limit인지, describe·top으로 확정하고 한도 부족인지 메모리 누수인지 가르는 법, JVM/Node 같은 런타임의 컨테이너 인식 설정, 노드 레벨 OOM까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["OOMKilled", "메모리", "limit", "트러블슈팅", "리소스", "JVM", "디버깅", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-imagepullbackoff/)에서 이미지를 못 받아 컨테이너가 시작조차 못 하는 경우를 봤다면, 이번에는 잘 돌던 컨테이너가 어느 순간 갑자기 죽는 경우다. `kubectl describe`로 보면 `Reason: OOMKilled`, 종료 코드는 137. 컨테이너가 메모리 한도를 넘겨서 리눅스 커널의 OOM(Out Of Memory) Killer가 강제로 죽인 것이다. 이 장애가 까다로운 이유는, 컨테이너가 정상적으로 한참 돌다가 부하나 누수가 쌓인 뒤에야 터지기 때문에 재현과 원인 분리가 쉽지 않다는 데 있다.

## OOM의 경계선은 request가 아니라 limit이다

OOMKilled를 이해하려면 먼저 `requests`와 `limits`의 역할을 분리해야 한다. 둘은 자주 헷갈리지만 완전히 다른 일을 한다.

- **request**는 스케줄러가 "이 Pod를 어느 노드에 놓을까"를 결정할 때 쓰는 **예약량**이다. 메모리 OOM과는 직접 관련이 없다.
- **limit**은 "이 컨테이너가 절대 넘어선 안 되는 상한"이다. 컨테이너의 메모리 사용량이 이 limit을 넘는 순간, 커널의 cgroup 메모리 컨트롤러가 OOM Killer를 호출해 컨테이너를 SIGKILL로 즉시 종료한다.

즉 **OOMKill이 일어나는 선은 언제나 limit**이다. request를 아무리 크게 잡아도 limit이 작으면 그 limit에서 죽고, request가 작아도 limit이 넉넉하면 살아남는다.

![메모리가 limit에 닿으면 OOMKill](/assets/posts/k8s-oomkilled-graph.svg)

CPU와의 차이도 알아두면 좋다. CPU는 limit을 넘으면 **throttling**(속도 제한)이 걸릴 뿐 프로세스를 죽이지 않는다. 메모리는 압축할 수 없는 자원이라 한도를 넘으면 회수할 방법이 없어 **즉시 종료**로 간다. 그래서 메모리 limit은 CPU limit보다 훨씬 신중하게 잡아야 한다.

## 진단 — 확정부터 한다

`describe`에서 OOMKilled를 확인하는 것이 첫 걸음이다. 다른 종료(앱 에러로 인한 137 등)와 헷갈리지 않으려면 `Reason` 필드를 정확히 봐야 한다.

```bash
# Reason: OOMKilled 가 찍혔는지 확정
kubectl describe pod web-7d9f-abcde | grep -i -A3 'last state'
```

확정했으면 실제 사용량 추세를 본다. `kubectl top`으로 컨테이너가 limit 대비 얼마나 쓰는지, 그리고 시간에 따라 어떻게 변하는지 관찰한다.

![OOMKilled 진단과 조치](/assets/posts/k8s-oomkilled-diagnose.svg)

```bash
# 컨테이너별 실시간 메모리 사용량 (메트릭 서버 필요)
kubectl top pod web-7d9f-abcde --containers
```

## 한도가 작은가, 앱이 새는가

OOMKilled의 원인은 크게 두 갈래다. 이 둘을 구분하는 것이 핵심이다 — 처방이 정반대이기 때문이다.

**(A) 한도가 그냥 빡빡한 경우.** 앱이 정상적으로 쓰는 메모리가 limit보다 살짝 큰데 limit을 너무 짜게 잡았다. 사용량 그래프가 어느 수준에서 평평하게 안정되는 모양이면 이쪽이다. 해법은 단순하다 — 실사용량에 여유분(headroom)을 더해 limit을 올린다. 보통 피크 사용량의 1.2~1.5배 정도를 잡는다.

```yaml
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "512Mi"   # 실측 피크 약 380Mi + 여유
```

**(B) 메모리 누수인 경우.** 사용량이 시간이 갈수록 계속 우상향한다면 앱이 메모리를 흘리고 있다. 이때 limit만 올리면 **더 늦게 또 죽을 뿐** 근본 해결이 안 된다. 힙 덤프나 프로파일러로 어디서 메모리가 쌓이는지 찾아야 한다. 힙 덤프를 컨테이너 밖으로 꺼낼 때는 [앞서 본](/posts/k8s-kubectl-debugging/) `kubectl cp`가 유용하다.

```bash
# 컨테이너 안의 힙 덤프를 로컬로 회수
kubectl cp web-7d9f-abcde:/tmp/heap.hprof ./heap.hprof
```

## 런타임에게 한도를 알려줘야 한다

JVM이나 Node.js 같은 런타임은 OOMKilled의 단골 함정을 하나 더 갖고 있다. 옛날 JVM은 컨테이너 limit이 아니라 **호스트 전체 메모리**를 보고 힙 크기를 정했다. 노드가 64GB면 limit이 512Mi여도 JVM이 수 GB 힙을 잡으려 들어 즉시 OOMKilled된다. 최신 JVM은 cgroup limit을 인식하지만, 여전히 명시적으로 알려주는 편이 안전하다.

```yaml
env:
  - name: JAVA_TOOL_OPTIONS
    value: "-XX:MaxRAMPercentage=75.0"
```

`MaxRAMPercentage`는 컨테이너 limit의 몇 %를 힙 상한으로 쓸지 지정한다. limit 512Mi에 75%면 힙은 최대 384Mi 정도가 되고, 나머지는 비-힙 메모리(스레드 스택, 메타스페이스, 네이티브 버퍼)의 몫으로 남긴다. 이 비-힙 영역을 깜빡하고 힙을 limit에 꽉 채우게 잡으면, 힙은 한도 안인데도 전체 메모리가 limit을 넘어 OOMKilled되는 흔한 함정에 빠진다.

## 노드 레벨 OOM과 QoS

컨테이너 단위 OOMKill 말고, **노드 전체의 메모리가 부족할 때**도 OOM이 일어난다. 이때 커널은 어떤 Pod를 먼저 죽일지 골라야 하는데, 그 우선순위가 바로 QoS 클래스다. `limits`를 설정하지 않은 BestEffort Pod가 가장 먼저 희생되고, request와 limit이 같은 Guaranteed Pod가 가장 잘 보호받는다. 중요한 워크로드일수록 request·limit을 제대로 설정해 Guaranteed에 가깝게 만들어 두는 것이 노드 압박 상황에서의 생존율을 높인다.

## 정리 — 그리고 다음

OOMKilled의 경계선은 언제나 limit이고, 진단은 `describe`로 Reason을 확정한 뒤 `top`으로 사용량 추세를 보는 것에서 시작한다. 추세가 평평하면 한도가 작은 것이니 limit을 올리고, 계속 우상향하면 누수이니 힙 덤프로 잡는다 — limit만 올려선 안 된다. JVM·Node 같은 런타임에는 컨테이너 한도를 명시적으로 알려주고, 비-힙 메모리 몫을 남겨둬야 한다. 다음 글에서는 컨테이너가 죽는 게 아니라 아예 뜨지도 못하고 `Pending` 상태에 묶이는, 스케줄링 단계의 장애를 다룬다.

---

**지난 글:** [ImagePullBackOff — 이미지를 가져오지 못할 때](/posts/k8s-imagepullbackoff/)

**다음 글:** [Pending Pod — 스케줄링되지 못하는 Pod 진단하기](/posts/k8s-pending-pods/)

<br>
읽어주셔서 감사합니다. 😊
