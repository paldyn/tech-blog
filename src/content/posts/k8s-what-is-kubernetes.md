---
title: "Kubernetes란 무엇인가? 컨테이너 오케스트레이션 완전 입문"
description: "Kubernetes의 탄생 배경, 핵심 기능 6가지, 그리고 왜 현대 인프라의 표준이 됐는지를 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "쿠버네티스", "컨테이너", "오케스트레이션", "CNCF", "DevOps"]
featured: false
draft: false
---

컨테이너 기술이 보편화되면서 하나의 서버에서 수십 개의 컨테이너를 운영하는 일이 일상이 됐다. 그런데 컨테이너 수가 늘어날수록 "어떤 서버에 어떤 컨테이너를 올릴지", "죽은 컨테이너를 어떻게 자동으로 살릴지", "트래픽이 폭증할 때 어떻게 빠르게 늘릴지"를 사람이 직접 관리하기는 점점 어려워진다. Kubernetes(쿠버네티스, 줄여서 K8s)는 바로 이 문제를 풀기 위해 Google이 만들고 2014년 오픈소스로 공개한 **컨테이너 오케스트레이션 플랫폼**이다.

## Kubernetes의 탄생

Google은 Borg라는 내부 클러스터 관리 시스템으로 수년간 수십억 개의 컨테이너를 운영해왔다. 그 경험을 바탕으로 오픈소스 버전인 Kubernetes를 설계했고, 2015년 v1.0이 출시됐다. 이후 Cloud Native Computing Foundation(CNCF)에 기증돼 현재는 AWS, Azure, GCP, Red Hat 등 주요 클라우드·기업이 모두 기여하는 사실상의 업계 표준이 됐다.

이름 "Kubernetes"는 그리스어로 **조타수(helmsman)** 또는 **항해사**를 뜻한다. 로고의 방향타(wheel)는 여기서 비롯됐다.

![Kubernetes란 무엇인가 - 개요](/assets/posts/k8s-what-is-kubernetes-overview.svg)

## 핵심 개념: 선언형(Declarative) 운영

Kubernetes의 가장 중요한 철학은 **선언형 구성**이다. 운영자는 "Pod 3개를 항상 실행하라"는 **원하는 상태(Desired State)**를 YAML로 기술하고, Kubernetes는 현재 상태(Current State)를 원하는 상태에 맞게 **자동으로 조정**한다.

```yaml
# 원하는 상태를 선언: nginx Pod를 3개 유지
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3          # Pod 3개
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
```

위 파일을 클러스터에 적용하면 Kubernetes가 알아서 Pod를 3개 생성하고, 하나가 죽으면 새로 만들어 항상 3개를 유지한다.

## Kubernetes 핵심 기능 6가지

![Kubernetes 핵심 기능](/assets/posts/k8s-what-is-kubernetes-features.svg)

**자가 치유(Self-healing)**: 컨테이너가 크래시하거나 응답이 없으면 자동으로 재시작하거나 다른 노드로 옮긴다. 담당자가 밤중에 깨어나 수동으로 재시작할 필요가 없다.

**자동 스케일링**: 트래픽이 늘면 HPA(Horizontal Pod Autoscaler)가 Pod 수를 자동으로 늘리고, 줄면 줄인다. 클러스터 자체도 Cluster Autoscaler로 노드를 자동 추가/제거할 수 있다.

**롤링 업데이트 및 롤백**: 새 버전 배포 시 Pod를 하나씩 교체해 서비스 중단 없이 업그레이드한다. 문제가 생기면 `kubectl rollout undo`로 즉시 이전 버전으로 돌아갈 수 있다.

**서비스 디스커버리 및 로드 밸런싱**: Service 오브젝트가 동일한 레이블을 가진 Pod 집합에 DNS 이름과 고정 IP를 부여하고, 트래픽을 자동으로 분산한다.

**스토리지 오케스트레이션**: PersistentVolume(PV)과 PersistentVolumeClaim(PVC)을 통해 클라우드 스토리지(EBS, GCE PD 등)나 NFS를 Pod에 추상화해서 연결한다.

**시크릿 및 설정 관리**: ConfigMap과 Secret 오브젝트로 데이터베이스 URL, API 키 같은 민감 정보를 코드에서 분리해 관리한다.

## 클러스터의 기본 구조

Kubernetes 클러스터는 크게 두 계층으로 나뉜다.

```
클러스터 구성
├── Control Plane (마스터)
│   ├── API Server   — 모든 통신의 관문
│   ├── etcd         — 클러스터 상태 저장소
│   ├── Scheduler    — Pod를 노드에 배치
│   └── Controller Manager — 상태 조정 루프
└── Worker Node (워커)
    ├── kubelet      — 노드 에이전트
    ├── kube-proxy   — 네트워크 규칙 관리
    └── Container Runtime (containerd 등)
```

Control Plane은 클러스터 전체를 지휘하는 두뇌이고, Worker Node는 실제 컨테이너(Pod)가 실행되는 실행 환경이다. 이 구조는 이후 글에서 각각 상세히 다룰 것이다.

## 언제 Kubernetes가 필요한가?

Kubernetes가 항상 정답은 아니다. 작은 팀이나 단순한 서비스라면 오히려 과도한 복잡성이 될 수 있다. 아래 상황이 해당된다면 Kubernetes를 진지하게 검토해야 한다.

- 마이크로서비스가 10개 이상으로 늘어나 관리 부담이 커질 때
- 트래픽 변동이 심해 자동 스케일링이 필요할 때
- 무중단 배포가 비즈니스 요구사항일 때
- 멀티 클라우드 또는 하이브리드 환경을 운영할 때
- 개발/스테이징/프로덕션 환경을 일관성 있게 관리하고 싶을 때

단일 서버에 1~2개 서비스라면 Docker Compose로도 충분하다. 하지만 서비스가 성장할수록 Kubernetes의 가치는 기하급수적으로 높아진다.

## 다음 글 예고

이번 글에서는 Kubernetes가 무엇인지, 왜 필요한지를 살펴봤다. 다음 글에서는 오케스트레이션이 왜 필요한지를 더 깊이 파고들어, Docker만으로 운영할 때 어떤 한계가 생기는지 실제 시나리오로 설명한다.

---

**다음 글:** [왜 오케스트레이션이 필요한가 — 컨테이너 운영의 현실](/posts/k8s-why-orchestration/)

<br>
읽어주셔서 감사합니다. 😊
