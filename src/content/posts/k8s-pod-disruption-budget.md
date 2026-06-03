---
title: "쿠버네티스 PodDisruptionBudget — 자발적 중단으로부터 Pod를 보호하는 방법"
description: "Kubernetes PodDisruptionBudget(PDB)의 개념, minAvailable·maxUnavailable 설정, 자발적/비자발적 중단 차이, 운영 환경 적용 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "PodDisruptionBudget", "PDB", "가용성", "자발적 중단", "Eviction", "고가용성"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-eviction/)에서 kubelet이 리소스 압박 시 Pod를 강제 퇴출하는 메커니즘을 살펴봤습니다. 이번 글에서는 방향을 바꿔, **운영자나 도구가 의도적으로 Pod를 제거하려 할 때** 가용성을 지키는 방법인 PodDisruptionBudget을 다룹니다.

## 자발적 중단이란?

쿠버네티스에서 Pod 중단은 크게 두 종류로 나뉩니다. **비자발적 중단(Involuntary Disruption)**은 노드 하드웨어 장애, 커널 패닉, OOM 킬처럼 예기치 않게 발생합니다. 반면 **자발적 중단(Voluntary Disruption)**은 `kubectl drain`, 롤링 업데이트, Cluster Autoscaler의 노드 축소처럼 _사람 또는 시스템이 의도적으로_ 시작하는 작업에서 발생합니다.

PDB는 자발적 중단에만 효과가 있습니다. 비자발적 중단은 막을 수 없으므로, 그쪽은 레플리케이션과 멀티존 배포로 대비해야 합니다.

![PDB 개념 — minAvailable·maxUnavailable 설정](/assets/posts/k8s-pod-disruption-budget-concept.svg)

## PDB 핵심 필드

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
  namespace: production
spec:
  minAvailable: 2          # 최소 2개 Pod가 Available이어야 함
  # maxUnavailable: 1      # 또는 이 방식으로 표현 (둘 중 하나만)
  selector:
    matchLabels:
      app: web-server
```

`minAvailable`과 `maxUnavailable`은 **둘 중 하나만** 지정합니다. 정수 또는 퍼센트(`"75%"`) 모두 허용합니다. 퍼센트 지정 시 현재 replicas 기준으로 계산하므로, 스케일 아웃/인 시에도 자동 적용됩니다.

| 필드 | 의미 | 예시 |
|---|---|---|
| `minAvailable: 2` | 최소 2개 Pod Available | replicas=4 → 최대 2개 동시 중단 가능 |
| `maxUnavailable: 1` | 최대 1개 Pod Unavailable | replicas=4 → 3개 이상 Available 유지 |
| `minAvailable: "75%"` | replicas×75% 이상 유지 | replicas=8 → 최소 6개 유지 |

## Eviction API와 PDB 동작 원리

`kubectl drain`이나 롤링 업데이트 컨트롤러는 Pod를 직접 삭제하지 않고 **Eviction API**(`v1/eviction` 서브리소스)를 통해 제거 요청을 보냅니다. kube-apiserver는 이 요청을 받으면 해당 Pod가 속한 PDB를 검색하고 `disruptionsAllowed` 값을 확인합니다.

```
disruptionsAllowed = currentReplicas - minAvailable
                   = 4 - 2 = 2  →  최대 2개 동시 제거 가능
```

`disruptionsAllowed > 0`이면 Eviction을 허용하고 Pod를 삭제합니다. `0`이면 HTTP 429(Too Many Requests)를 반환해 요청자가 나중에 재시도하도록 합니다.

![PDB 자발적 중단 처리 흐름](/assets/posts/k8s-pod-disruption-budget-flow.svg)

## 실습: PDB 설정과 drain 테스트

```bash
# PDB 생성
kubectl apply -f - <<EOF
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: web-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: web-server
EOF

# 현재 PDB 상태 확인
kubectl get pdb web-pdb
# NAME      MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS   AGE
# web-pdb   2               N/A               2                     10s

# 노드 드레인 시도 (PDB가 보호 중인 Pod 있을 경우 429로 대기)
kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data
```

드레인 명령은 PDB가 허용할 때까지 반복 재시도합니다. 새 Pod가 다른 노드에서 Running 상태가 되면 `disruptionsAllowed`가 다시 증가하고, 다음 Pod를 제거합니다.

## PDB 설계 시 주의사항

**단일 Pod Deployment에 `minAvailable: 1` 설정 금지.** replicas=1이고 `minAvailable: 1`이면 `disruptionsAllowed=0`이 돼 영구 차단 상태가 됩니다. drain이 무한 대기하거나 업그레이드가 멈춥니다.

```bash
# 위험한 설정 예시
spec:
  replicas: 1            # Pod 1개
  # PDB에 minAvailable: 1 → drain 영구 차단!
```

대신 `minAvailable: 0` 또는 `maxUnavailable: 1`로 설정하거나, replicas를 2 이상으로 늘려야 합니다.

**StatefulSet에 PDB를 반드시 설정하세요.** 데이터베이스나 메시지 큐처럼 상태를 가진 워크로드는 갑작스러운 Pod 제거가 데이터 손실이나 쿼럼 붕괴로 이어질 수 있습니다. 예를 들어 3개 노드 Kafka 클러스터라면 `minAvailable: 2`를 설정해 과반수 이상이 항상 살아있도록 강제합니다.

## 운영 환경 권장 패턴

```yaml
# HPA와 함께 사용할 때는 퍼센트 기반 추천
spec:
  minAvailable: "60%"   # replicas 변동에도 자동 조정
  selector:
    matchLabels:
      app: my-app

# 중요도 높은 서비스는 네임스페이스별 PDB 일괄 설정
# ArgoCD ApplicationSet이나 Helm values로 관리
```

PDB는 `kubectl get pdb -A`로 전체 네임스페이스를 확인할 수 있습니다. `ALLOWED DISRUPTIONS`가 `0`인 채로 오래 유지되면 노드 드레인이나 업그레이드가 멈출 수 있으니 주기적으로 모니터링하세요.

---

**지난 글:** [쿠버네티스 Pod 퇴출(Eviction) — kubelet의 리소스 보호 메커니즘](/posts/k8s-pod-eviction/)

**다음 글:** [쿠버네티스 LimitRange — 네임스페이스 내 리소스 기본값과 제한](/posts/k8s-limit-range/)

<br>
읽어주셔서 감사합니다. 😊
