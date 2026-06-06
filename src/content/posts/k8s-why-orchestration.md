---
title: "왜 오케스트레이션이 필요한가 — 컨테이너 운영의 현실"
description: "컨테이너 수가 늘어날수록 수동 운영이 왜 한계에 부딪히는지, 오케스트레이션이 어떻게 이 문제를 해결하는지 실제 시나리오로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "오케스트레이션", "컨테이너", "DevOps", "자동화", "SRE"]
featured: false
draft: false
---

[지난 글](/posts/k8s-what-is-kubernetes/)에서 Kubernetes가 무엇인지 개념을 살펴봤다. 이번 글에서는 "왜 오케스트레이션이 필요한가"라는 더 근본적인 질문에 답한다. Docker만으로도 컨테이너를 실행할 수 있는데, 굳이 Kubernetes까지 써야 하는 이유가 무엇일까?

## 컨테이너 한 개는 쉽다

컨테이너 기술은 분명 강력하다. 개발 환경을 코드로 정의하고, 어디서든 동일하게 실행할 수 있다. 문제는 컨테이너가 **단 하나**일 때만 이야기가 깔끔하다는 것이다.

```bash
# 한 개는 이렇게 간단하다
docker run -d -p 80:80 --name web nginx:1.25

# 죽으면? 직접 재시작
docker start web
```

이 단순함은 컨테이너가 10개, 50개, 100개가 되는 순간 무너진다.

## 컨테이너 100개를 수동으로 운영한다면

실제 마이크로서비스 아키텍처에서 컨테이너 100개를 수동으로 운영하는 상황을 상상해보자.

```
현실적인 하루 운영 업무 목록
─────────────────────────────
- 06:30 auth-service 컨테이너 크래시 알림 수신
- 06:35 SSH 접속 → docker restart auth-service-1
- 09:00 마케팅 캠페인 시작 → 트래픽 5배 급증
- 09:05 product-api 컨테이너 메모리 부족으로 OOM
- 09:10 수동으로 컨테이너 5개 추가 실행
- 14:00 새 버전 배포 → 서비스 중단 2분 발생
- 23:00 야간 트래픽 감소 → 컨테이너 수 수동 축소
```

매일 이런 작업을 반복한다면 엔지니어가 운영에만 집중하게 되고, 정작 중요한 개발은 뒷전으로 밀린다.

![컨테이너 확산이 부르는 운영 복잡도](/assets/posts/k8s-why-orchestration-problem.svg)

## 수동 운영의 4가지 핵심 문제

![오케스트레이션이 해결하는 4가지 문제](/assets/posts/k8s-why-orchestration-benefits.svg)

### 1. 배포 실수

사람이 직접 서버에 SSH 접속해서 docker 명령을 실행하면 실수가 생긴다. 잘못된 이미지 태그, 환경 변수 누락, 포트 충돌. 그리고 이 실수는 대부분 밤 12시에 발견된다.

### 2. 장애 복구 지연

컨테이너가 죽으면 알림을 받고 → 접속하고 → 원인 파악하고 → 재시작하는데 최소 몇 분이 걸린다. 그 사이 사용자들은 오류 화면을 본다.

### 3. 리소스 낭비

트래픽이 낮은 새벽에도 피크 타임을 위한 서버를 모두 켜두어야 한다. 자동으로 줄였다가 늘릴 방법이 없기 때문이다.

### 4. 무중단 배포 불가

기존 컨테이너를 멈추고 새 컨테이너를 시작하는 사이 서비스가 중단된다. 그래서 많은 팀이 심야에만 배포하는 습관이 생긴다.

## Kubernetes가 이 문제를 어떻게 푸는가

```yaml
# 이 YAML 하나로 4가지 문제를 모두 해결
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 3                    # 항상 3개 유지 (자가 치유)
  strategy:
    type: RollingUpdate          # 무중단 업데이트
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: myrepo/auth:v2.1  # 배포 실수 방지 — 태그 명시
        resources:
          requests:
            memory: "128Mi"
            cpu: "250m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        livenessProbe:           # 자동 재시작 트리거
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
```

이 Deployment를 적용하면:
- **자가 치유**: Pod가 죽으면 수초 내 자동으로 새 Pod 생성
- **무중단 배포**: RollingUpdate로 하나씩 교체
- **리소스 제어**: requests/limits로 낭비 방지
- **자동 스케일링**: HPA를 추가하면 CPU 기준으로 replica 자동 조정

## 오케스트레이션은 선택이 아니다

Google은 내부 클러스터 관리 시스템 Borg로 하루 **20억 개**의 컨테이너를 실행한다. 이것이 오케스트레이션 없이 가능했을까? Netflix, Airbnb, Spotify는 수천 개의 마이크로서비스를 Kubernetes로 운영한다.

규모가 작더라도 서비스가 성장 궤도에 있다면, 지금부터 오케스트레이션 기반으로 설계하는 것이 나중에 전환 비용을 아끼는 길이다.

---

**지난 글:** [Kubernetes란 무엇인가?](/posts/k8s-what-is-kubernetes/)

**다음 글:** [Kubernetes vs Docker Compose — 무엇을 선택할까](/posts/k8s-vs-docker-compose/)

<br>
읽어주셔서 감사합니다. 😊
