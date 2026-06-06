---
title: "Kubernetes vs Docker Compose — 무엇을 선택할까"
description: "Docker Compose와 Kubernetes의 차이점을 비교하고, 프로젝트 규모와 요구사항에 따라 어떤 도구를 선택해야 하는지 결정 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "DockerCompose", "컨테이너", "인프라", "도구선택", "DevOps"]
featured: false
draft: false
---

[지난 글](/posts/k8s-why-orchestration/)에서 컨테이너 수가 늘어나면 수동 운영이 한계에 부딪힌다는 것을 살펴봤다. 그렇다면 당장 Kubernetes로 넘어가야 할까? 아니면 Docker Compose로도 충분할까? 이 질문은 생각보다 단순하지 않다.

## Docker Compose 먼저 이해하기

Docker Compose는 **단일 호스트** 위에서 여러 컨테이너를 함께 정의하고 실행하는 도구다. `docker-compose.yml` 파일 하나로 웹 서버, 데이터베이스, 캐시 서버를 동시에 띄울 수 있어 로컬 개발 환경에 최적화돼 있다.

```yaml
# docker-compose.yml — 로컬 개발용
version: '3.8'
services:
  web:
    image: myapp:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://db:5432/mydb
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

`docker compose up -d` 한 줄로 이 세 컨테이너가 동시에 실행된다. 개발자에게 이보다 편한 환경은 없다.

## 두 도구 비교

![Docker Compose vs Kubernetes 비교](/assets/posts/k8s-vs-docker-compose-comparison.svg)

핵심 차이는 **운영 환경**이다. Docker Compose는 단일 호스트용이라 서버 자체가 죽으면 모든 서비스가 함께 죽는다. Kubernetes는 여러 노드에 걸쳐 Pod를 분산 배치하고, 노드 장애 시 자동으로 다른 노드로 이전한다.

## 도구 선택 결정 트리

![도구 선택 결정 트리](/assets/posts/k8s-vs-docker-compose-decision.svg)

## 구체적 선택 기준

**Docker Compose가 맞는 상황:**
- 로컬 개발 환경 세팅
- 소규모 사이드 프로젝트 (1~5개 서비스)
- CI/CD 파이프라인에서 통합 테스트 실행
- 단일 서버에 배포하는 소규모 서비스

**Kubernetes가 맞는 상황:**
- 프로덕션 환경에서 고가용성(HA) 필요
- 트래픽 변동에 따른 자동 스케일링 필요
- 10개 이상 마이크로서비스 운영
- 무중단 배포가 비즈니스 요구사항
- 멀티 클라우드·하이브리드 환경

## 같이 쓰는 패턴도 일반적이다

두 도구는 경쟁 관계가 아니다. 실제 현장에서는 **로컬 개발은 Compose, 프로덕션은 Kubernetes**를 조합하는 경우가 많다.

```bash
# Kompose: Docker Compose 파일을 K8s YAML로 변환
brew install kompose
kompose convert -f docker-compose.yml

# 결과: deployment.yaml, service.yaml 생성
ls *.yaml
# redis-deployment.yaml    redis-service.yaml
# db-deployment.yaml       db-service.yaml
# web-deployment.yaml      web-service.yaml
```

Kompose로 100% 완벽한 변환을 기대하기는 어렵지만, 시작점으로 유용하다. 결국 K8s YAML은 Compose보다 훨씬 세밀한 제어가 가능하기 때문에 수동으로 조정이 필요하다.

## 결론

Docker Compose는 **개발자 생산성** 도구고, Kubernetes는 **운영 안정성** 플랫폼이다. 작게 시작해서 Compose로 개발하고, 서비스가 성장하면 Kubernetes로 이전하는 것이 현실적인 경로다. 처음부터 Kubernetes를 도입할 수도 있지만, 팀의 학습 비용을 감안해야 한다.

다음 글부터는 Kubernetes 클러스터의 내부 구조를 본격적으로 파헤친다.

---

**지난 글:** [왜 오케스트레이션이 필요한가](/posts/k8s-why-orchestration/)

**다음 글:** [Kubernetes 스케줄러 — Pod는 어떻게 노드에 배치되는가](/posts/k8s-scheduler/)

<br>
읽어주셔서 감사합니다. 😊
