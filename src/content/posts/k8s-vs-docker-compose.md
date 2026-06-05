---
title: "Kubernetes vs Docker Compose: 무엇을 선택해야 할까?"
description: "Docker Compose와 Kubernetes의 목적·구조·적합한 사용 상황을 비교하고, 두 도구의 개념 매핑(service→Pod, volumes→PVC 등)을 통해 Compose에서 K8s로 이전하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["docker", "kubernetes", "k8s", "compose", "orchestration", "비교"]
featured: false
draft: false
---

[지난 글](/posts/k8s-why-orchestration/)에서 오케스트레이션이 필요한 이유와 K8s가 해결하는 문제들을 살펴봤다. 이번에는 실제 프로젝트에서 자주 마주치는 선택의 순간을 다룬다. "이제 Kubernetes를 써야 하나, 아니면 Docker Compose로 충분한가?" 이 선택 기준을 명확히 잡아보자.

## 목적부터 다르다

Docker Compose는 **단일 호스트**에서 여러 컨테이너를 함께 실행하는 도구다. 로컬 개발 환경에서 앱 + DB + 캐시를 한 번에 올리는 데 최적화되어 있다. YAML 한 파일에 모든 설정이 들어가고 `docker compose up` 한 줄로 실행된다.

Kubernetes는 **여러 노드(서버)**에 걸쳐 컨테이너를 자동으로 스케줄링하고, 장애가 나면 다른 노드에 재배포하며, 부하에 따라 수평 확장하는 분산 오케스트레이션 플랫폼이다.

```bash
# Compose: 개발 환경 시작 (단 1줄)
docker compose up -d

# K8s: 클러스터에 배포 (각 리소스를 개별 적용)
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

## 기능별 비교

![Kubernetes vs Docker Compose 비교표](/assets/posts/k8s-vs-docker-compose-comparison.svg)

두 도구를 6가지 핵심 항목으로 비교하면 차이가 명확해진다.

| 항목 | Docker Compose | Kubernetes |
|---|---|---|
| 실행 범위 | 단일 호스트 | 멀티 노드 클러스터 |
| 스케일링 | 수동 replicas 지정 | HPA 자동 스케일링 |
| 고가용성 | 지원 안 함 | 자동 재스케줄링 |
| 네트워킹 | 브리지 네트워크 | Service + DNS + NetworkPolicy |
| 스토리지 | 로컬 볼륨 마운트 | PV/PVC + StorageClass |
| 프로덕션 적합성 | 제한적 | 프로덕션 표준 |

## 개념 매핑: Compose에서 K8s로

Compose 경험이 있다면 아래 대응표로 K8s 리소스를 이해하는 것이 가장 빠르다.

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
# compose.yml (Docker Compose)
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
# K8s 버전 — Deployment + Secret 분리
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
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

## 언제 어떤 도구를 선택할까?

![Docker Compose vs Kubernetes 선택 가이드](/assets/posts/k8s-vs-docker-compose-when.svg)

**Docker Compose가 적합한 상황:**

- 팀이 소규모이고 단일 서버로 충분한 경우
- 개발·스테이징 환경 재현이 주 목적인 경우
- CI/CD에서 테스트 환경을 임시로 구동하는 경우
- 마이크로서비스 수가 5개 미만인 경우

**Kubernetes 전환을 고려할 상황:**

- 서비스 장애 시 자동 재시작, 다른 노드 재배포가 필요한 경우
- 트래픽에 따른 자동 수평 확장(HPA)이 필요한 경우
- 멀티 환경(dev/staging/prod)을 동일한 선언적 방식으로 관리해야 하는 경우
- DevOps/인프라 역량을 갖추고 있거나 투자 계획이 있는 경우

## 현실적인 전략: 두 도구를 함께 쓰기

Compose와 K8s는 배타적인 선택이 아니다. 로컬 개발은 Compose로 하고, CI에서 이미지를 빌드한 뒤 K8s에 배포하는 패턴이 업계 표준이다.

```bash
# 로컬: Compose로 개발 환경 실행
docker compose up -d

# CI: 이미지 빌드 후 레지스트리 push
docker build -t myapp:${GIT_SHA} .
docker push myregistry/myapp:${GIT_SHA}

# CD: K8s에 배포 (이미지 태그 업데이트)
kubectl set image deployment/myapp \
  app=myregistry/myapp:${GIT_SHA}
```

K8s가 낯설다면 먼저 개발 환경에 [minikube](https://minikube.sigs.k8s.io/) 또는 [kind](https://kind.sigs.k8s.io/)로 로컬 클러스터를 구축해 학습하는 것이 좋다.

## 마이그레이션 경로

Compose에서 K8s로 이전할 때 `Kompose` 도구를 사용하면 자동 변환이 가능하다.

```bash
# kompose로 compose.yml을 K8s 매니페스트로 변환
kompose convert -f compose.yml

# 생성된 파일 확인 후 적용
ls *.yaml
kubectl apply -f .
```

단, 자동 변환된 결과는 그대로 사용하기보다 리뷰 후 수정하는 것이 권장된다. K8s의 강점을 온전히 활용하려면 리소스 요청/제한, 헬스체크 프로브, PVC 등을 직접 설정해야 한다.

---

**지난 글:** [쿠버네티스가 필요한 이유](/posts/k8s-why-orchestration/)

**다음 글:** [쿠버네티스 YAML 매니페스트 완전 정복](/posts/k8s-yaml-manifests/)
