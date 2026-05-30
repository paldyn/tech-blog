---
title: "쿠버네티스란 무엇인가?"
description: "쿠버네티스(Kubernetes)의 탄생 배경, 핵심 개념, 컨테이너 오케스트레이션이 해결하는 문제를 다룹니다. K8s를 처음 접하는 분들을 위한 입문 가이드입니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["kubernetes", "k8s", "container", "orchestration", "devops"]
featured: false
draft: false
---

컨테이너 기술이 보편화되면서 하나의 서버에서 수십~수백 개의 컨테이너를 실행하는 시대가 열렸다. 그런데 컨테이너가 많아질수록 "언제 어떤 컨테이너가 죽었는지", "어떤 서버에 컨테이너를 배치할지", "트래픽이 몰릴 때 어떻게 늘릴지"를 사람이 직접 관리하는 건 불가능에 가까워진다. **쿠버네티스(Kubernetes, K8s)**는 이 문제를 해결하는 오픈소스 컨테이너 오케스트레이션 플랫폼이다.

## 탄생 배경

구글은 오래전부터 내부적으로 **Borg**라는 컨테이너 스케줄러를 사용해왔다. Borg는 수만 대의 서버에서 컨테이너를 자동으로 배치·관리하는 시스템으로, 구글 내부의 거의 모든 서비스가 이 위에서 동작했다. 2014년 구글은 Borg의 경험을 바탕으로 오픈소스 프로젝트로 **Kubernetes**를 공개했다.

이름인 "Kubernetes"는 그리스어로 "항해사" 또는 "조타수"를 뜻하며, 영어 약어로 **K8s**(K와 s 사이 글자가 8개)라고 표기한다. 2016년 CNCF(Cloud Native Computing Foundation)에 기증된 이후 현재는 클라우드 네이티브 생태계의 사실상 표준(de facto standard)으로 자리잡았다.

## 컨테이너 운영의 현실적 문제

![쿠버네티스 도입 전후 비교](/assets/posts/k8s-what-is-kubernetes-overview.svg)

컨테이너를 직접 운영할 때 맞닥뜨리는 문제는 크게 네 가지다.

**장애 복구**: 컨테이너가 예상치 못하게 종료되면 사람이 수동으로 재시작해야 한다. 새벽 3시에 장애가 나도 누군가는 깨어나야 한다.

**스케일링**: 이벤트나 마케팅으로 트래픽이 갑자기 몰리면 컨테이너를 늘려야 하는데, 어느 서버에 얼마나 더 실행할지 계산해서 직접 실행해야 한다.

**배포 일관성**: 개발/스테이징/프로덕션 환경마다 같은 방법으로 배포되도록 보장하기 어렵다. "내 환경에선 되는데?" 문제가 계속 발생한다.

**무중단 배포**: 새 버전을 배포할 때 기존 버전을 먼저 내리면 서비스가 잠깐 중단된다. 동시에 두 버전을 운영하며 교체하는 로직을 직접 구현해야 한다.

K8s는 이 모든 문제를 자동으로 처리한다.

## 쿠버네티스가 하는 일

![쿠버네티스 핵심 기능](/assets/posts/k8s-what-is-kubernetes-features.svg)

K8s의 핵심 철학은 **선언적(Declarative) 관리**다. "3개의 복제본을 항상 유지하라", "CPU 70% 넘으면 자동으로 확장하라"처럼 원하는 **상태(Desired State)**를 YAML로 선언하면, K8s가 실제 상태(Actual State)를 선언한 상태에 맞게 맞춰나간다.

```yaml
# 항상 3개의 복제본을 유지하는 Deployment 선언
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3          # 원하는 상태: 파드 3개
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:1.0
        resources:
          requests:
            cpu: "200m"
            memory: "128Mi"
```

이 YAML을 적용하면 K8s는 3개의 파드를 유지한다. 하나가 죽으면 자동으로 새 파드를 만들고, 노드가 죽으면 다른 노드에 파드를 재배치한다. 사람이 개입할 필요가 없다.

```bash
# YAML 적용
kubectl apply -f deployment.yaml

# 파드 상태 확인
kubectl get pods

# Deployment 상세 확인
kubectl describe deployment myapp

# 자동 복구 테스트: 파드를 강제 종료해보기
kubectl delete pod <pod-name>
# → K8s가 즉시 새 파드를 생성함
```

## K8s vs Docker: 역할 분담

흔히 "K8s가 Docker를 대체한다"고 오해하지만, 두 기술은 역할이 다르다.

| 구분 | Docker | Kubernetes |
|---|---|---|
| 역할 | 컨테이너 빌드 및 실행 | 컨테이너 오케스트레이션 |
| 단위 | 컨테이너 1개 | 수백~수천 개 컨테이너 클러스터 |
| 상태 관리 | 없음 (수동) | 선언적 상태 자동 유지 |
| 스케일링 | 수동 | HPA로 자동 |
| 범위 | 단일 호스트 | 멀티 노드 클러스터 |

실무에서는 Docker로 이미지를 빌드하고, K8s 위에서 그 이미지를 실행·관리하는 패턴을 사용한다.

## 언제 K8s를 도입해야 할까?

K8s는 강력하지만, 모든 프로젝트에 필요한 건 아니다. 일반적인 기준은 다음과 같다.

- **컨테이너가 5개 미만, 단일 서버**: Docker Compose로 충분
- **마이크로서비스 10개 이상, 무중단 배포 필요**: K8s 도입 검토
- **팀 규모가 크고, 멀티 클라우드/하이브리드 환경**: K8s가 거의 필수

K8s를 직접 설치·운영하는 대신, AWS EKS, GCP GKE, Azure AKS 같은 매니지드 서비스를 사용하면 컨트롤 플레인 관리 부담을 클라우드에 위임할 수 있다.

---

**다음 글:** [왜 컨테이너 오케스트레이션이 필요한가?](/posts/k8s-why-orchestration/)

<br>
읽어주셔서 감사합니다. 😊
