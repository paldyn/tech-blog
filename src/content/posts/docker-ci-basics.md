---
title: "Docker CI 기초 — 컨테이너로 빌드 파이프라인 구성하기"
description: "컨테이너 기반 CI의 개념, docker build/run을 파이프라인에 통합하는 방법, 레이어 캐시 최적화 전략, GitLab CI와 Jenkins 기초 예제를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "ci", "pipeline", "빌드자동화", "레이어캐시", "devops"]
featured: false
draft: false
---

[지난 글](/posts/docker-debug-dns/)에서 컨테이너 네트워크·DNS 문제를 진단하는 방법을 살펴봤다. 디버깅까지 익혔다면 이제 빌드·배포를 자동화할 차례다. **CI(Continuous Integration)**는 코드가 푸시될 때마다 자동으로 빌드·테스트·패키징하는 과정이며, Docker는 이 과정의 환경 일관성 문제를 깔끔하게 해결한다.

## 왜 컨테이너 기반 CI인가

![컨테이너 기반 CI 파이프라인](/assets/posts/docker-ci-basics-pipeline.svg)

전통적인 CI는 빌드 서버에 의존성을 직접 설치한다. Node 버전 충돌, Python 패키지 혼재, "내 컴퓨터에서는 됐는데" 문제가 여기서 발생한다. 컨테이너 기반 CI는 모든 빌드 단계를 **이미지 안에서 실행**해 환경 자체를 격리한다. 로컬 개발 이미지와 CI 이미지가 동일하므로 재현성이 보장된다.

```bash
# CI에서 가장 단순한 Docker 사용 패턴
docker build -t myapp:${GIT_SHA} .
docker run --rm myapp:${GIT_SHA} npm test
docker push myregistry.io/myapp:${GIT_SHA}
```

## GitLab CI 기초 예제

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - push

variables:
  IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $IMAGE .
    - docker save $IMAGE | gzip > image.tar.gz
  artifacts:
    paths:
      - image.tar.gz
    expire_in: 1 hour

test:
  stage: test
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker load < image.tar.gz
    - docker run --rm $IMAGE npm test

push:
  stage: push
  image: docker:24
  services:
    - docker:24-dind
  only:
    - main
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker load < image.tar.gz
    - docker push $IMAGE
    - docker tag $IMAGE $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:latest
```

## Jenkins Declarative Pipeline

```groovy
// Jenkinsfile
pipeline {
  agent any
  environment {
    REGISTRY = 'myregistry.io'
    IMAGE    = "${REGISTRY}/myapp:${env.GIT_COMMIT[0..6]}"
  }
  stages {
    stage('Build') {
      steps {
        sh 'docker build -t $IMAGE .'
      }
    }
    stage('Test') {
      steps {
        sh 'docker run --rm $IMAGE pytest tests/'
      }
    }
    stage('Push') {
      when { branch 'main' }
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'registry-creds',
          usernameVariable: 'USER',
          passwordVariable: 'PASS'
        )]) {
          sh 'docker login -u $USER -p $PASS $REGISTRY'
          sh 'docker push $IMAGE'
        }
      }
    }
  }
  post {
    always {
      sh 'docker rmi $IMAGE || true'
    }
  }
}
```

## 레이어 캐시 전략

![Docker 빌드 캐시 전략](/assets/posts/docker-ci-basics-cache.svg)

CI 빌드에서 가장 큰 시간을 먹는 것은 **의존성 설치**다. Dockerfile에서 의존성 레이어를 소스 코드 레이어보다 앞에 두면, 소스만 변경됐을 때 의존성 레이어를 재사용한다.

```dockerfile
# 좋은 예: 의존성 먼저 복사
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci                   # 이 레이어가 캐시됨
COPY src/ ./src/
RUN npm run build
```

```dockerfile
# 나쁜 예: 소스 전체를 먼저 복사
FROM node:20-alpine
WORKDIR /app
COPY . .                     # 소스 변경 시 아래 전부 무효화
RUN npm ci
RUN npm run build
```

## CI 레지스트리 캐시 활용

빌드 러너가 매번 교체되는 환경(GitHub Actions, GitLab 공유 러너)에서는 로컬 캐시가 없다. `--cache-from`으로 레지스트리에서 이전 이미지를 캐시로 가져온다.

```bash
# 이전 이미지를 캐시 소스로 사용
docker pull myregistry.io/myapp:cache || true

docker build \
  --cache-from myregistry.io/myapp:cache \
  --tag myregistry.io/myapp:${SHA} \
  --tag myregistry.io/myapp:cache \
  .

# 캐시 이미지를 레지스트리에 업데이트
docker push myregistry.io/myapp:cache
docker push myregistry.io/myapp:${SHA}
```

BuildKit의 `--cache-to type=registry`를 쓰면 더 효율적이지만, 레지스트리가 OCI manifest 확장을 지원해야 한다. 다음 글에서 GitHub Actions와 함께 자세히 다룬다.

## 멀티 서비스 테스트: docker compose up

```yaml
# docker-compose.test.yml
services:
  app:
    build: .
    depends_on:
      db:
        condition: service_healthy
    command: pytest tests/integration/

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: testdb
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      retries: 5
```

```bash
# CI 스크립트
docker compose -f docker-compose.test.yml up \
  --abort-on-container-exit \
  --exit-code-from app

docker compose -f docker-compose.test.yml down -v
```

`--abort-on-container-exit`는 어느 한 서비스가 종료되면 전체를 멈춘다. `--exit-code-from app`은 app 컨테이너의 종료 코드를 파이프라인 결과로 전달한다.

## 이미지 태그 전략

| 태그 | 사용 시점 | 예시 |
|---|---|---|
| `latest` | main 브랜치 최신 | `myapp:latest` |
| Git SHA | 커밋 단위 불변 참조 | `myapp:a3f9c12` |
| 버전 태그 | 릴리즈 시점 | `myapp:v1.2.3` |
| 브랜치 | PR 리뷰용 | `myapp:feature-login` |

`latest`는 편리하지만 **무엇이 배포됐는지 추적이 어렵다**. 프로덕션에는 항상 Git SHA나 버전 태그를 사용한다.

---

**지난 글:** [컨테이너 DNS 문제 진단과 수정](/posts/docker-debug-dns/)

**다음 글:** [GitHub Actions로 Docker 이미지 빌드 자동화하기](/posts/docker-github-actions-build/)

<br>
읽어주셔서 감사합니다. 😊
