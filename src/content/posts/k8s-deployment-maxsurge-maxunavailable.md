---
title: "maxSurge와 maxUnavailable 심층 분석"
description: "Kubernetes Deployment Rolling Update의 핵심 파라미터인 maxSurge와 maxUnavailable의 계산 공식, 절댓값·퍼센트 방식, 상황별 최적 설정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Deployment", "maxSurge", "maxUnavailable", "Rolling Update", "배포 전략"]
featured: false
draft: false
---

[지난 글](/posts/k8s-rolling-update-rollback/)에서 Rolling Update의 전체 흐름과 rollback 방법을 다뤘습니다. 이번에는 롤링 업데이트의 속도와 안전성을 제어하는 두 파라미터 **maxSurge**와 **maxUnavailable**을 깊이 살펴봅니다. 이 두 값의 조합이 배포 중 리소스 사용량과 서비스 가용성을 결정합니다.

## maxSurge란

`maxSurge`는 롤링 업데이트 중 **`replicas`보다 얼마나 많은 Pod를 추가로 생성할 수 있는지**를 정의합니다. `replicas: 4`, `maxSurge: 1`이면 업데이트 중 최대 5개 Pod가 동시에 존재할 수 있습니다.

```yaml
spec:
  strategy:
    rollingUpdate:
      maxSurge: 1       # 절댓값
      # 또는
      maxSurge: "25%"   # 퍼센트 (ceil 적용)
```

`maxSurge`가 클수록 새 버전 Pod가 빠르게 투입되어 롤아웃 속도가 빨라지지만, 그만큼 추가 리소스(CPU, 메모리, IP 등)가 필요합니다.

## maxUnavailable이란

`maxUnavailable`은 롤링 업데이트 중 **동시에 Unavailable 상태가 될 수 있는 최대 Pod 수**를 정의합니다. `replicas: 4`, `maxUnavailable: 1`이면 최소 3개 Pod는 항상 Ready 상태여야 합니다.

```yaml
spec:
  strategy:
    rollingUpdate:
      maxUnavailable: 1     # 절댓값
      # 또는
      maxUnavailable: "25%" # 퍼센트 (floor 적용)
```

`maxUnavailable`이 클수록 한 번에 많은 Pod가 교체되어 빠르지만, 그만큼 가용 용량이 줄어듭니다.

## 계산 공식

퍼센트 방식은 `replicas` 수에 비율을 적용합니다.

- **maxSurge**: `ceil(replicas × 비율)` — 올림
- **maxUnavailable**: `floor(replicas × 비율)` — 내림

```
replicas=10, maxSurge="25%", maxUnavailable="25%" 기준:
  maxSurge = ceil(10 × 0.25) = ceil(2.5) = 3
  maxUnavailable = floor(10 × 0.25) = floor(2.5) = 2
  → 최대 13 Pod, 최소 8 Ready
```

![maxSurge와 maxUnavailable 시각화](/assets/posts/k8s-maxsurge-visualization.svg)

## 세 가지 주요 패턴

### 안전 우선: maxSurge=1, maxUnavailable=0

새 Pod가 Ready 상태가 된 후에만 구 Pod를 제거합니다. 롤링 업데이트 내내 `replicas`만큼의 Ready Pod가 보장됩니다. 속도는 느리지만 서비스 중단이 없습니다.

```yaml
rollingUpdate:
  maxSurge: 1
  maxUnavailable: 0
```

**적합한 상황**: 데이터베이스 커넥션 풀 한도가 있는 서비스, 라이선스 기반 소프트웨어, Singleton 컴포넌트.

### 속도 우선: maxSurge=0, maxUnavailable=1

구 Pod를 먼저 종료한 후 새 Pod를 투입합니다. 추가 노드 리소스 없이 업데이트할 수 있지만, 업데이트 중 `replicas-maxUnavailable`개만 서비스합니다.

```yaml
rollingUpdate:
  maxSurge: 0
  maxUnavailable: 1
```

**적합한 상황**: 리소스 여유가 없는 환경, GPU 같은 고가 리소스를 사용하는 배치 Job.

### 균형: 기본값 25% + 25%

대부분의 웹 서비스에 적합한 기본값입니다.

```yaml
rollingUpdate:
  maxSurge: "25%"
  maxUnavailable: "25%"
```

![maxSurge / maxUnavailable YAML 예시](/assets/posts/k8s-maxsurge-yaml.svg)

## 제약 조건

`maxSurge`와 `maxUnavailable`이 **동시에 0이 되면 API 서버가 Deployment 생성을 거부**합니다. 업데이트가 영원히 진행될 수 없기 때문입니다.

```bash
# 오류 재현
kubectl create deployment web --image=nginx \
  --dry-run=client -o yaml | \
  kubectl patch --dry-run=client -f - \
    -p '{"spec":{"strategy":{"rollingUpdate":{"maxSurge":0,"maxUnavailable":0}}}}'
# Error: maxUnavailable and maxSurge cannot both be zero
```

## HPA와 함께 사용 시 주의사항

HPA(Horizontal Pod Autoscaler)가 활성화된 경우, 롤링 업데이트 중 HPA가 `replicas`를 변경하면 maxSurge/maxUnavailable 계산의 기준값이 달라질 수 있습니다. 배포 중에는 HPA minReplicas를 일시적으로 높게 설정해두거나, `kubectl rollout pause`로 HPA가 개입하기 전에 검증 시간을 확보하는 것이 좋습니다.

```bash
# 배포 전 HPA 상태 확인
kubectl get hpa web-hpa

# 배포 중 Pod 수 모니터링
watch kubectl get pods -l app=web
```

---

**지난 글:** [쿠버네티스 Rolling Update와 Rollback](/posts/k8s-rolling-update-rollback/)

**다음 글:** [Deployment progressDeadlineSeconds와 배포 타임아웃](/posts/k8s-deployment-progress-deadline/)

<br>
읽어주셔서 감사합니다. 😊
