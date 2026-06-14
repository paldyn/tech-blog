---
title: "Kubernetes vs Docker Compose: 무엇을 선택해야 할까?"
description: "Docker Compose와 Kubernetes의 목적·구조·적합한 사용 상황을 비교하고, 두 도구의 개념 매핑(service→Pod, volumes→PVC 등)을 통해 Compose에서 K8s로 이전하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["docker", "kubernetes", "k8s", "compose", "orchestration", "비교"]
featured: false
draft: false
---

컨테이너를 로컬에서 다뤄봤다면, 실제 서비스를 운영할 때 자연스럽게 떠오르는 질문이 있다. "이제 Kubernetes를 써야 하나, 아니면 Docker Compose로 충분한가?" 이번 편에서는 그 선택 기준을 명확히 잡는다.

## 목적부터 다르다

![Kubernetes vs Docker Compose 비교](/assets/posts/k8s-vs-docker-compose-comparison.svg)

Docker Compose는 단일 호스트에서 여러 컨테이너를 함께 실행하는 도구다. 로컬 개발 환경에서 앱 + DB + 캐시를 한 번에 올리는 데 최적화되어 있다. YAML 한 파일에 모든 설정이 들어가고 `docker compose up` 한 줄로 실행된다.

Kubernetes는 여러 노드(서버)에 걸쳐 컨테이너를 자동으로 스케줄링하고, 장애가 나면 다른 노드에 재배포하며, 부하에 따라 수평 확장하는 분산 오케스트레이션 플랫폼이다. 학습 곡선이 높지만 프로덕션 고가용성 요구사항을 충족하는 실질적인 선택지다.

```bash
# Compose: 개발 환경 시작
docker compose up -d

# K8s: 클러스터에 배포
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

## 개념 매핑

![개념 매핑: Compose → Kubernetes](/assets/posts/k8s-vs-docker-compose-mapping.svg)

Compose 경험이 있다면 K8s 리소스를 이 대응표로 이해하는 것이 가장 빠르다.

| Docker Compose | Kubernetes | 차이점 |
|---|---|---|
| `service:` | Pod + Deployment | K8s는 레플리카 관리, 롤링 업데이트 포함 |
| `image:` | `spec.containers[].image` | 동일한 이미지 참조 방식 |
| `ports:` | Service (ClusterIP/NodePort) | K8s는 네트워크 추상화가 별도 리소스 |
| `volumes:` | PersistentVolumeClaim | K8s는 동적 스토리지 프로비저닝 |
| `environment:` | ConfigMap + Secret | 설정값과 민감정보를 분리하는 구조 |
| `depends_on:` | initContainers, readinessProbe | 더 정교한 의존성 제어 |
| `networks:` | Namespace + NetworkPolicy | 더 세밀한 격리 정책 |

## 실제 비교: 같은 앱을 두 도구로 작성

```yaml
# compose.yml (Compose)
services:
  app:
    image: myapp:1.0
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=db
      - DB_PASS=secret
    depends_on:
      - db
    restart: always

  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```yaml
# K8s 버전 — Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3                          # Compose에는 없는 멀티 레플리카
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
        env:
        - name: DB_HOST
          value: "db-service"
        - name: DB_PASS
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
```

K8s 버전은 파일이 여러 개(Deployment, Service, Secret, PVC, Ingress)로 나뉜다. 복잡해 보이지만 각 리소스가 명확한 역할을 하고 독립적으로 관리된다.

## 언제 Compose, 언제 K8s인가

**Compose를 유지하는 상황:**
- 팀이 소규모이고 단일 서버로 충분
- 개발·스테이징 환경 재현 목적
- CI/CD에서 테스트 환경 임시 구동
- 마이크로서비스 수가 5개 미만

**K8s로 전환을 고려할 상황:**
- 서비스 장애 시 자동 재시작, 다른 노드 재배포가 필요
- 트래픽에 따른 자동 수평 확장(HPA) 필요
- 멀티 환경(dev/staging/prod)을 동일한 선언적 방식으로 관리
- 팀이 DevOps/인프라 역량을 갖추고 있거나 투자 계획이 있을 때

## 현실적인 전략

Compose와 K8s는 배타적인 선택이 아니다. 로컬 개발은 Compose로 하고, CI에서 이미지를 빌드한 뒤 K8s에 배포하는 패턴이 업계 표준이다.

```bash
# 로컬: Compose로 개발
docker compose up -d

# CI: 이미지 빌드 후 레지스트리 push
docker build -t myapp:${GIT_SHA} .
docker push myregistry/myapp:${GIT_SHA}

# CD: K8s에 배포
kubectl set image deployment/myapp \
  app=myregistry/myapp:${GIT_SHA}
```

K8s가 낯설다면 먼저 개발 환경에 [minikube](https://minikube.sigs.k8s.io/) 또는 [kind](https://kind.sigs.k8s.io/)로 로컬 클러스터를 구축해 학습하는 것이 좋다. 다음 편부터는 K8s의 핵심 개념인 Pod, Deployment, Service를 하나씩 살펴본다.

---

**다음 글:** [쿠버네티스 파드(Pod) 기초](/posts/k8s-pod-basics/)

<br>
읽어주셔서 감사합니다. 😊
