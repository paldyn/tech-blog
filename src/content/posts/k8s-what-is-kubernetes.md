---
title: "쿠버네티스란 무엇인가"
description: "구글이 만들고 CNCF가 관리하는 컨테이너 오케스트레이션 플랫폼 쿠버네티스(Kubernetes)의 탄생 배경, 핵심 철학, 클러스터 구조를 소개합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "container", "orchestration", "cluster", "control-plane"]
featured: false
draft: false
---

컨테이너 하나를 실행하는 건 쉽다. 하지만 수백, 수천 개의 컨테이너가 여러 서버에 걸쳐 동시에 돌고 있을 때 이를 안정적으로 배포·운영·복구하는 일은 전혀 다른 차원의 문제다. **쿠버네티스(Kubernetes, K8s)**는 바로 이 문제를 풀기 위해 만들어진 컨테이너 오케스트레이션 플랫폼이다.

## 쿠버네티스의 탄생

구글은 2000년대 중반부터 사내 컨테이너 오케스트레이션 시스템인 **Borg**를 운영했다. Borg는 하루 수십억 개의 컨테이너를 관리하며 구글 검색·지메일·유튜브를 지탱했다. 이 경험을 오픈소스로 정리한 것이 2014년 발표된 쿠버네티스다. 이후 2016년 CNCF(Cloud Native Computing Foundation)에 기증돼 현재는 사실상 업계 표준이 됐다.

이름의 어원은 고대 그리스어 κυβερνήτης(조타수)다. 로고의 방향타 모양도 여기서 나왔다. 흔히 K와 s 사이 8글자를 숫자로 줄여 **K8s**로 표기한다.

## 쿠버네티스가 해결하는 문제

가상 머신 시대엔 애플리케이션 배포가 느렸다. OS 부팅에 수 분이 걸렸고, 새 서버를 추가하려면 수동 설치·설정이 필요했다. 컨테이너가 등장하면서 이 문제는 크게 개선됐지만, Docker Compose는 **단일 호스트**에서만 작동했다.

쿠버네티스는 다음 문제를 자동으로 처리한다.

| 문제 | K8s의 해결 방식 |
|---|---|
| 컨테이너 장애 | 자동 재시작 · 재배치 |
| 트래픽 급증 | HPA로 Pod 수 자동 조절 |
| 배포 위험 | 롤링 업데이트 + 롤백 |
| 서비스 디스커버리 | DNS 기반 내부 서비스 이름 |
| 설정 관리 | ConfigMap · Secret 분리 |
| 스토리지 | PersistentVolume 추상화 |

## 클러스터 구조

쿠버네티스 클러스터는 크게 **컨트롤 플레인**과 **워커 노드**로 나뉜다.

![쿠버네티스 클러스터 구조](/assets/posts/k8s-what-is-kubernetes-overview.svg)

### 컨트롤 플레인

클러스터 전체의 두뇌 역할을 한다. 프로덕션 환경에서는 고가용성(HA)을 위해 3대 이상의 서버에 분산 배치한다.

- **API Server**: 모든 요청의 진입점. kubectl, 다른 컴포넌트, 외부 도구가 모두 API Server를 통해 클러스터와 통신한다
- **etcd**: 클러스터의 모든 상태(오브젝트 메타데이터, 설정, 시크릿 등)를 저장하는 분산 KV 스토어
- **Scheduler**: 새로운 Pod가 생성되면 어떤 노드에 배치할지 결정한다
- **Controller Manager**: Deployment, ReplicaSet, Node 등 다양한 컨트롤러를 실행하며 desired state와 actual state를 지속적으로 동기화한다
- **Cloud Controller Manager**: AWS·GCP·Azure 등 클라우드 프로바이더의 리소스(로드밸런서, 볼륨 등)를 제어한다

### 워커 노드

실제 컨테이너(Pod)가 실행되는 서버다. 각 노드에는 3가지 컴포넌트가 반드시 실행된다.

- **kubelet**: 컨트롤 플레인의 지시를 받아 컨테이너 런타임을 통해 Pod를 실행·모니터링한다
- **kube-proxy**: 서비스 IP로 들어온 트래픽을 올바른 Pod로 라우팅하는 네트워크 프록시
- **Container Runtime**: 실제 컨테이너 이미지를 다운로드하고 실행하는 엔진. 현재 표준은 **containerd**

## 선언적 모델

쿠버네티스의 가장 핵심적인 철학은 **선언적(Declarative) 방식**이다. "컨테이너를 3개 실행해라"라고 명령하는 대신, "항상 3개가 실행되고 있어야 한다"고 선언한다.

![K8s 핵심 오브젝트 계층](/assets/posts/k8s-what-is-kubernetes-concepts.svg)

```yaml
# Deployment: "항상 3개 Pod가 실행돼야 한다"고 선언
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: my-app:1.0
        ports:
        - containerPort: 8080
```

위 YAML을 `kubectl apply -f`로 적용하면, K8s는 현재 Pod 수를 확인하고 3개가 될 때까지 자동으로 생성한다. 이후 노드 장애로 Pod가 사라지면 다른 노드에 자동으로 재생성한다. 개발자는 상태를 선언만 하면 K8s가 알아서 유지한다.

## K8s 생태계

쿠버네티스 자체는 핵심 오케스트레이션만 담당한다. 실무에서는 주변 생태계와 함께 사용한다.

```text
모니터링: Prometheus + Grafana
로깅:     EFK(Elasticsearch-Fluentd-Kibana) / Loki
CI/CD:    ArgoCD, Flux (GitOps)
서비스메시: Istio, Linkerd
패키지 관리: Helm, Kustomize
보안:     OPA Gatekeeper, Kyverno
```

이 모든 도구는 K8s API와 통합되며, CNCF Landscape에서 조회할 수 있다.

---

**다음 글:** [쿠버네티스가 필요한 이유 — 오케스트레이션이란](/posts/k8s-why-orchestration/)

<br>
읽어주셔서 감사합니다. 😊
