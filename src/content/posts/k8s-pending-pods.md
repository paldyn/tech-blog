---
title: "Pending Pod — 스케줄링되지 못하는 Pod 진단하기"
description: "Pod가 노드에 배정되지 못하고 Pending에 묶이는 스케줄링 단계 장애를 다룹니다. 스케줄러의 필터-점수 흐름, FailedScheduling 메시지 읽는 법, 그리고 자원 부족·노드 셀렉터/어피니티 불일치·테인트 미허용·PVC 미바인딩·노드 부족이라는 단골 원인별 진단과 해결, kubectl describe로 0/N nodes 메시지를 해석하는 법까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["Pending", "스케줄링", "스케줄러", "트러블슈팅", "어피니티", "테인트", "PVC", "Kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-oomkilled/)까지는 컨테이너가 실행되다가 죽거나, 이미지를 못 받아 막히는 문제였다. 이번 `Pending`은 그보다 더 앞 단계 — 컨테이너가 어느 노드에서 돌지조차 정해지지 않은 상태다. `kubectl get pods`에서 STATUS가 `Pending`이고 NODE 칸이 비어 있다면, 스케줄러가 이 Pod를 받아줄 노드를 아직 찾지 못한 것이다. CrashLoop이나 OOMKilled와 달리 컨테이너가 실행 전이라 로그는 텅 비어 있다. 그래서 진단의 시선을 앱이 아니라 **스케줄러와 노드** 쪽으로 돌려야 한다.

## Pending이란 — 노드 배정 전 상태

Pod가 만들어지면 스케줄러가 클러스터의 모든 노드를 두 단계로 평가한다. 먼저 **필터(filter)** 단계에서 이 Pod를 도저히 못 받는 노드를 걸러내고, 남은 후보 중에서 **점수(score)** 단계로 가장 적합한 노드를 고른다. 필터를 통과하는 노드가 하나도 없으면, 스케줄러는 Pod를 어디에도 배정하지 못하고 `Pending` 상태로 둔 채 주기적으로 재시도한다.

![스케줄링되지 못하면 Pending](/assets/posts/k8s-pending-pods-scheduling.svg)

여기서 핵심은, 스케줄러가 **왜 못 배정했는지를 친절하게 적어둔다**는 점이다. 그 메시지가 `describe`의 Events에 `FailedScheduling`으로 남는다.

```bash
# Pending의 진짜 이유는 여기 적혀 있다
kubectl describe pod web-7d9f-abcde | grep -A5 Events
```

대표적인 문구는 이런 모양이다 — `0/5 nodes are available: 3 Insufficient cpu, 2 node(s) had untolerated taint`. 5개 노드 중 3개는 CPU가 부족하고 2개는 테인트 때문에 막혔다는 뜻이다. 이 한 줄을 정확히 읽는 것이 진단의 절반이다.

## 단골 원인 다섯 갈래

FailedScheduling 메시지의 문구로 원인이 거의 정해진다.

![Pending 단골 원인과 Events 메시지](/assets/posts/k8s-pending-pods-causes.svg)

### 1) 자원 부족 (Insufficient cpu / memory)

가장 흔하다. Pod의 `requests`를 수용할 여유가 있는 노드가 없다. 여기서 다시 강조할 점은, 스케줄링은 **실사용량이 아니라 request의 합**으로 판단한다는 것이다. 노드가 실제로는 한가해 보여도, 이미 배정된 Pod들의 request 합이 노드 용량을 채웠다면 새 Pod는 못 들어간다.

```bash
# 노드별 할당(request) 현황 확인
kubectl describe node worker-1 | grep -A8 'Allocated resources'
```

해법은 세 가지다 — Pod의 request를 현실적으로 줄이거나, 노드를 늘리거나(수동 또는 Cluster Autoscaler/Karpenter), 큰 Pod라면 더 큰 노드 타입을 준비한다.

### 2) 노드 셀렉터·어피니티 불일치

`nodeSelector`나 `nodeAffinity`로 "이런 라벨을 가진 노드에만 배치"를 걸었는데, 그 조건을 만족하는 노드가 없는 경우다. 예를 들어 `disktype=ssd` 라벨을 요구했는데 그런 노드가 없거나, 특정 가용 영역을 강제했는데 거기에 여유가 없을 때다.

```bash
# 라벨을 가진 노드가 실제로 있는지 확인
kubectl get nodes -l disktype=ssd
```

오타거나(라벨 키/값 불일치), 정말 그런 노드가 없는 것이다. 라벨을 노드에 붙이거나, `requiredDuringScheduling`을 `preferred`로 완화하는 것을 검토한다.

### 3) 테인트 미허용 (untolerated taint)

노드에 테인트가 걸려 있어 일반 Pod의 접근을 막는데, 이 Pod에는 그 테인트를 견딜 `toleration`이 없다. 전용 노드(GPU, 시스템 워크로드용 등)에서 자주 본다. 해당 노드에 꼭 배치해야 한다면 toleration을 추가한다.

```yaml
tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "gpu"
    effect: "NoSchedule"
```

### 4) PVC 미바인딩

`pod has unbound immediate PersistentVolumeClaims` — Pod가 요구하는 PVC가 아직 PV에 묶이지 않았다. StorageClass가 없거나, 동적 프로비저너가 동작하지 않거나, 접근 모드(ReadWriteOnce 등)·토폴로지 조건이 안 맞는 경우다. PVC 상태를 직접 확인한다.

```bash
kubectl get pvc
kubectl describe pvc data-web-0
```

### 5) 그 외 — 토폴로지/Affinity 충돌, 노드 부족

`topologySpreadConstraints`나 Pod anti-affinity가 너무 엄격해 분산 조건을 만족할 노드가 없거나, 클러스터에 노드 자체가 부족한 경우다. 오토스케일러가 있다면 노드가 새로 뜰 때까지 잠시 Pending이 정상일 수 있다 — 이때는 잠깐 기다리면 풀린다.

## 임시 Pending과 영구 Pending을 구분하라

모든 Pending이 장애는 아니다. Cluster Autoscaler나 Karpenter를 쓰는 환경에서는 새 워크로드가 노드 증설을 **유발**하기 위해 잠깐 Pending에 머무는 것이 정상 흐름이다. 몇 분 뒤 노드가 붙으면서 스케줄링된다. 반면 메시지가 계속 같은 `FailedScheduling`으로 고정돼 있고 노드도 늘지 않는다면 영구 Pending이다. Events의 타임스탬프와 메시지 변화를 보면 둘을 가를 수 있다.

## 정리 — 그리고 다음

Pending은 컨테이너 실행 전, 스케줄링 단계의 장애다. 로그는 비어 있으니 `describe`의 `FailedScheduling` 메시지로 직행한다. `0/N nodes are available: ...` 한 줄이 자원 부족인지, 라벨 불일치인지, 테인트인지, 볼륨 문제인지 거의 정확히 알려준다. 스케줄링은 실사용량이 아니라 request 합으로 판단한다는 점, 그리고 오토스케일 환경의 임시 Pending은 정상일 수 있다는 점을 기억하자. 다음 글에서는 클러스터 내부 통신의 근간인 DNS가 말썽일 때를 다루는 `DNS 트러블슈팅`으로 넘어간다.

---

**지난 글:** [OOMKilled — 메모리 한도를 넘어 강제 종료될 때](/posts/k8s-oomkilled/)

**다음 글:** [DNS 트러블슈팅 — 서비스 이름이 풀리지 않을 때](/posts/k8s-dns-troubleshooting/)

<br>
읽어주셔서 감사합니다. 😊
