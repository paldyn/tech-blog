---
title: "왜 컨테이너 오케스트레이션이 필요한가?"
description: "마이크로서비스 환경에서 컨테이너 수가 늘어날수록 발생하는 운영 복잡성과, 쿠버네티스 오케스트레이션이 이 문제를 어떻게 해결하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "orchestration", "microservices", "container", "devops"]
featured: false
draft: false
---

[지난 글](/posts/k8s-what-is-kubernetes/)에서 쿠버네티스가 무엇인지 개념을 살펴봤다. 이번에는 "왜 오케스트레이션이 필요한가?"라는 질문에 좀 더 구체적으로 답해본다. 모든 기술 도입에는 이유가 있다. K8s를 도입해야 하는 이유를 이해하면, K8s의 각 기능이 왜 그렇게 설계되었는지도 자연스럽게 이해된다.

## 모노리스에서 마이크로서비스로

초기 서비스는 보통 **모노리스(Monolith)** 형태로 시작한다. 하나의 코드베이스에 모든 기능이 담겨 있고 한 서버에서 실행된다. 간단하고 배포하기 쉽다.

하지만 서비스가 성장하면 문제가 생긴다. 한 기능을 배포하려면 전체를 재배포해야 한다. 주문 서비스의 버그가 결제 서비스까지 다운시킨다. 트래픽이 몰리는 기능만 따로 확장할 수 없다.

이 문제를 해결하기 위해 **마이크로서비스(Microservices)** 아키텍처로 전환한다. 각 기능을 독립된 서비스로 분리해 개별 배포·확장이 가능하게 한다. 그런데 서비스를 분리하는 순간 새로운 문제가 등장한다.

## 컨테이너 수가 늘면 생기는 문제들

![오케스트레이션 없는 세계의 문제들](/assets/posts/k8s-why-orchestration-problems.svg)

서비스 5개가 각각 3개의 복제본으로 실행된다면 컨테이너는 15개다. 100개 서비스라면 300개가 넘는다. 이 상황에서 맞닥뜨리는 문제를 구체적으로 살펴보자.

### 1. 배치 문제: 어떤 서버에 실행할까?

서버가 5대 있고 컨테이너를 새로 배포해야 한다. 어느 서버에 실행해야 CPU와 메모리를 효율적으로 쓸 수 있을까? 매번 직접 확인하고 결정해야 한다.

```bash
# 수동 배치의 현실 — 서버마다 상태 확인 후 결정
ssh server1 "docker stats --no-stream"
ssh server2 "docker stats --no-stream"
# ... 적절한 서버 선택 후 배포
ssh server3 "docker run -d myapp:1.0"
```

서버가 10대, 20대로 늘어나면 이 과정 자체가 배포 병목이 된다.

### 2. 고가용성 문제: 장애 시 어떻게 복구할까?

```bash
# 장애 감지조차 수동
watch -n 5 "docker ps | grep myapp"
# 컨테이너 죽으면 알림 받고 → 수동 재시작
docker restart <container-id>
```

새벽 2시에 장애가 나면 온콜 담당자를 깨워야 한다. 서비스가 복구될 때까지 수십 분에서 수 시간이 소요된다.

### 3. 스케일링 문제: 트래픽 폭증 대응

이벤트로 갑자기 트래픽이 10배로 늘어났다. 컨테이너를 늘려야 하지만, 어느 서버에 얼마나 늘려야 할지 계산해서 직접 실행해야 한다. 트래픽이 줄면 다시 수동으로 정리해야 한다.

### 4. 서비스 연결 문제: IP가 바뀌면 어떻게?

마이크로서비스끼리 통신할 때 IP 주소를 직접 쓰면, 컨테이너가 재시작될 때마다 IP가 바뀌어 연결이 끊긴다. 서비스 레지스트리, 헬스체크, 로드밸런서를 별도로 구축해야 한다.

## 오케스트레이션이 주는 해답

K8s는 위 문제들을 시스템 레벨에서 해결한다.

**배치 → Scheduler**: 각 노드의 CPU/메모리 여유를 계산해 최적의 노드를 자동 선택한다. `kubectl apply` 한 번이면 끝이다.

**고가용성 → Self-healing**: kubelet이 각 파드의 상태를 지속 감시한다. 파드가 죽으면 즉시 재시작하고, 노드가 죽으면 다른 노드에 자동으로 이동시킨다.

**스케일링 → HPA**: CPU/메모리 사용률 기반으로 파드 수를 자동 조절한다. 트래픽이 몰리면 수십 초 안에 파드가 추가된다.

**서비스 연결 → Service + DNS**: K8s Service 오브젝트가 안정적인 DNS 이름과 가상 IP를 제공한다. 파드 IP가 바뀌어도 서비스 이름으로 항상 연결된다.

```yaml
# 오케스트레이션이 적용된 실제 구성 예시
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    spec:
      containers:
      - name: app
        image: user-service:2.1
        resources:
          requests:
            cpu: "200m"
            memory: "256Mi"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: user-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: user-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
```

이 YAML 하나로 user-service는 항상 3~20개 사이로 자동 유지되고, 장애 시 자동 복구되며, 서비스 이름(`user-service`)으로 다른 서비스에서 접근할 수 있게 된다.

## K8s가 기본으로 제공하는 핵심 기능 6가지

![쿠버네티스 핵심 기능 6가지](/assets/posts/k8s-why-orchestration-features.svg)

### Self-healing (자동 복구)

파드가 충돌하거나 노드가 다운되면 K8s는 즉시 다른 노드에 파드를 재스케줄링한다. 온콜 담당자를 깨우지 않아도 365일 24시간 자동 복구가 이루어진다.

### Auto-scaling (HPA)

`HorizontalPodAutoscaler` 리소스를 선언하면 CPU 또는 메모리 사용률에 따라 파드 수가 자동으로 `minReplicas`에서 `maxReplicas` 사이에서 조절된다. 트래픽 폭증과 감소 모두 자동 대응한다.

### Service Discovery

`ClusterIP` Service와 CoreDNS가 결합해 `http://user-service:8080` 같은 안정적인 DNS 이름을 제공한다. 파드 IP가 변경되어도 서비스 이름으로 항상 접근 가능하다.

### Rolling Update

새 버전 배포 시 파드를 하나씩 교체해 다운타임 없이 업그레이드한다. 문제가 생기면 `kubectl rollout undo` 한 줄로 이전 버전으로 즉시 롤백된다.

### Secret Management

비밀번호, API 키 같은 민감 정보를 `Secret` 리소스로 분리 저장한다. 코드에 하드코딩하는 실수를 구조적으로 방지하며, `ConfigMap`으로 비민감 설정도 외부화한다.

### Persistent Storage

`PersistentVolume`과 `PersistentVolumeClaim`으로 파드 생명주기와 독립적인 스토리지를 관리한다. 파드가 재시작되거나 다른 노드로 이동해도 데이터는 보존된다.

## 오케스트레이션 도입의 트레이드오프

K8s가 많은 문제를 해결해주지만, 도입 자체의 비용도 있다.

| 항목 | 비용 |
|---|---|
| 학습 곡선 | 개념이 많다 (Pod, Deployment, Service, Ingress, ...) |
| 초기 설정 | 클러스터 구성, 네트워크, 스토리지 설정 |
| 운영 부담 | etcd 백업, 노드 업그레이드, 모니터링 |
| 리소스 | 컨트롤 플레인 자체도 CPU/메모리를 사용 |

이 비용은 서비스 규모가 클수록 운영 자동화 이득이 훨씬 크기 때문에 상쇄된다. 반대로 소규모 서비스라면 Docker Compose가 더 합리적인 선택일 수 있다. 다음 글에서는 그 경계선을 명확히 짚어본다.

---

**지난 글:** [쿠버네티스란 무엇인가](/posts/k8s-what-is-kubernetes/)

**다음 글:** [쿠버네티스 vs Docker Compose](/posts/k8s-vs-docker-compose/)
