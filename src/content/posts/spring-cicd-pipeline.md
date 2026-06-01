---
title: "Spring Boot CI/CD 파이프라인: GitHub Actions부터 ECS 배포까지"
description: "Spring Boot 프로젝트에 GitHub Actions 기반 CI/CD 파이프라인을 구성하는 방법을 단계별로 설명합니다. 테스트 자동화, Docker 이미지 빌드, ECR 푸시, 롤링/블루그린/카나리 배포 전략을 실전 예제로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring Boot", "CI/CD", "GitHub Actions", "Docker", "ECS", "DevOps", "배포전략"]
featured: false
draft: false
---

[지난 글](/posts/spring-dockerizing/)에서 Spring Boot 애플리케이션을 Docker 이미지로 효율적으로 패키징하는 방법을 살펴봤다. 이번 글에서는 그 이미지를 자동으로 빌드하고 프로덕션에 배포하는 CI/CD 파이프라인을 구성한다. GitHub Actions를 기반으로 테스트 자동화부터 AWS ECS 배포까지 실전 파이프라인을 단계별로 만들어 본다.

## CI/CD의 목표

CI(지속적 통합)는 코드 변경이 생길 때마다 자동으로 빌드·테스트해서 문제를 조기 발견하는 것이 목표다. CD(지속적 배포)는 테스트를 통과한 빌드 산출물을 자동으로 스테이징 혹은 프로덕션에 배포하는 것이다. 이 두 가지를 잘 구성하면 배포가 두려운 이벤트에서 평범한 일상으로 바뀐다.

![CI/CD 파이프라인 전체 흐름](/assets/posts/spring-cicd-pipeline-flow.svg)

## 기본 CI 워크플로우 구성

GitHub Actions에서 워크플로우는 `.github/workflows/` 디렉터리에 YAML 파일로 정의한다.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'gradle'          # Gradle 캐시 자동 관리

      - name: Grant execute permission
        run: chmod +x gradlew

      - name: Run tests
        run: ./gradlew test

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-report
          path: build/reports/tests/
```

`cache: 'gradle'` 하나만 추가해도 의존성 다운로드 시간이 대폭 줄어든다. 첫 번째 실행에서 캐시를 채우고, 이후 실행은 `~/.gradle/caches`를 재사용한다.

## Docker 이미지 빌드 및 ECR 푸시

테스트 통과 후 Docker 이미지를 빌드해서 AWS ECR에 업로드한다.

```yaml
  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    permissions:
      id-token: write   # OIDC 토큰 발급
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'gradle'

      - name: Build JAR
        run: ./gradlew bootJar -x test

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-2

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPO: my-spring-app
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG .
          docker build -t $ECR_REGISTRY/$ECR_REPO:latest .
          docker push $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPO:latest
          echo "image=$ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG" >> $GITHUB_OUTPUT
        id: image
```

비밀 키 대신 OIDC(`id-token: write`)를 사용하면 AWS 크리덴셜이 워크플로우에 저장되지 않아 더 안전하다. AWS 콘솔에서 GitHub Actions OIDC 공급자를 등록하고 역할에 ECR 푸시 권한을 부여하면 된다.

## 배포 전략 선택

![배포 전략 비교](/assets/posts/spring-cicd-pipeline-strategies.svg)

### 롤링 배포

기존 인스턴스를 순차적으로 새 버전으로 교체한다. 추가 리소스 없이 배포 가능하지만, 교체 중간에 v1과 v2가 동시에 서비스되므로 API 하위 호환성이 보장돼야 한다.

```yaml
      - name: Deploy to ECS (Rolling)
        run: |
          aws ecs update-service \
            --cluster my-cluster \
            --service my-service \
            --task-definition my-task:$TASK_DEF_REVISION \
            --force-new-deployment
```

### 블루/그린 배포

완전히 새로운 환경(Green)에 새 버전을 배포하고, 로드밸런서에서 트래픽을 한 번에 전환한다. 즉시 롤백이 가능하지만 동시에 두 배의 인프라가 필요하다. AWS CodeDeploy와 ECS를 함께 사용하면 쉽게 구성할 수 있다.

### 카나리 배포

트래픽의 일부(예: 10%)만 새 버전으로 보내고, 오류율·응답시간 등 메트릭을 모니터링하면서 점진적으로 비율을 높인다. 가장 안전하지만 구성이 복잡하다. ALB의 가중치 라우팅이나 AWS App Mesh를 활용한다.

## 환경별 파이프라인 분리

스테이징과 프로덕션은 별도로 관리하는 것이 좋다.

```yaml
  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging     # GitHub Environments로 보호
    steps:
      - name: Deploy to staging
        run: |
          aws ecs update-service \
            --cluster staging-cluster \
            --service my-service \
            --task-definition my-task:latest

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # 수동 승인 게이트
    steps:
      - name: Deploy to production
        run: |
          aws ecs update-service \
            --cluster prod-cluster \
            --service my-service \
            --task-definition my-task:latest
```

GitHub Environments의 `Required reviewers`를 설정하면 프로덕션 배포 전에 승인 단계가 추가된다.

## Gradle 빌드 캐시 최적화

CI 환경에서 Gradle 빌드를 빠르게 만드는 핵심 설정들이다.

```properties
# gradle.properties
org.gradle.daemon=false          # CI에서 데몬 불필요
org.gradle.parallel=true         # 멀티 프로젝트 병렬 빌드
org.gradle.caching=true          # 빌드 캐시 활성화
org.gradle.jvmargs=-Xmx2g -XX:+HeapDumpOnOutOfMemoryError
```

GitHub Actions의 `cache: 'gradle'` 옵션과 함께 사용하면 의존성 재다운로드와 증분 컴파일이 모두 캐시된다.

## 배포 상태 확인

ECS에 배포한 뒤 서비스가 정상적으로 안정화됐는지 확인하는 단계를 추가하면 배포 실패를 조기에 감지할 수 있다.

```bash
# ECS 서비스 안정화 대기 (최대 10분)
aws ecs wait services-stable \
  --cluster my-cluster \
  --services my-service

# 헬스체크 엔드포인트 확인
curl -f https://api.example.com/actuator/health || exit 1
```

`aws ecs wait services-stable` 명령은 새 태스크가 모두 RUNNING 상태가 되고 이전 태스크가 STOPPED될 때까지 폴링한다. Spring Boot Actuator의 `/actuator/health`를 추가로 확인하면 애플리케이션 레벨의 준비 상태까지 검증할 수 있다.

## 정리

효율적인 CI/CD 파이프라인의 핵심은 빠른 피드백 루프다. 테스트 → 빌드 → 이미지 생성 → 배포의 각 단계를 자동화하되, 스테이징과 프로덕션 사이에 적절한 승인 게이트를 두면 속도와 안전성을 모두 확보할 수 있다.

---

**지난 글:** [Spring Boot 애플리케이션 도커라이징](/posts/spring-dockerizing/)

**다음 글:** [Spring Boot 시크릿 관리: 환경변수부터 AWS Secrets Manager까지](/posts/spring-secrets-management/)

<br>
읽어주셔서 감사합니다. 😊
