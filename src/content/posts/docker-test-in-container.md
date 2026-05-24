---
title: "컨테이너 안에서 테스트 실행하기"
description: "Docker로 테스트를 격리하는 3가지 패턴(이미지 직접 실행·Compose 통합·멀티 스테이지), 서비스 healthcheck 대기, 커버리지 보고서 추출, GitHub Actions 연동 완성 예제를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "testing", "pytest", "compose", "ci", "멀티스테이지", "통합테스트"]
featured: false
draft: false
---

[지난 글](/posts/docker-build-push-action/)에서 `build-push-action`으로 이미지를 빌드하고 레지스트리에 푸시하는 방법을 다뤘다. 이미지를 만들기 전에 테스트가 통과해야 한다. **컨테이너 안에서 테스트를 실행**하면 CI 환경과 로컬 환경이 완전히 동일해지고, 외부 의존성(DB, Redis 등)도 컨테이너로 함께 구동해 격리된 상태에서 통합 테스트가 가능하다.

## 3가지 테스트 패턴

![컨테이너 테스트 3가지 패턴](/assets/posts/docker-test-in-container-patterns.svg)

패턴을 선택하는 기준은 **외부 의존성 존재 여부**와 **prod 이미지 분리 필요성**이다.

## 패턴 1: 빌드된 이미지로 직접 실행

```bash
# 이미지 빌드 (테스트 의존성 포함)
docker build -t myapp:test .

# 테스트 실행
docker run --rm myapp:test pytest tests/unit/ -v

# 환경 변수 주입
docker run --rm \
  -e DATABASE_URL=sqlite:///:memory: \
  myapp:test \
  pytest tests/ --tb=short
```

유닛 테스트처럼 외부 서비스가 없어도 되는 경우에 가장 단순하다.

## 패턴 2: Compose로 통합 테스트

![Compose 통합 테스트 구성](/assets/posts/docker-test-in-container-compose.svg)

```yaml
# compose.test.yml
services:
  app:
    build: .
    command: pytest tests/ -v --cov=app --cov-report=xml
    environment:
      DATABASE_URL: postgresql://test:test@db:5432/testdb
      REDIS_URL: redis://redis:6379
    volumes:
      - ./coverage:/app/coverage   # 보고서 추출
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: testdb
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d testdb"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5
```

```bash
# 테스트 실행
docker compose -f compose.test.yml up \
  --build \
  --abort-on-container-exit \
  --exit-code-from app

# 결과 코드 저장 후 정리
EXIT_CODE=$?
docker compose -f compose.test.yml down -v
exit $EXIT_CODE
```

## 패턴 3: 멀티 스테이지 Dockerfile

```dockerfile
# Dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/

# 테스트 스테이지
FROM base AS test
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY tests/ ./tests/
RUN pytest tests/unit/ -v

# 프로덕션 스테이지 (테스트 통과 후에만 도달)
FROM base AS production
CMD ["gunicorn", "src.main:app"]
```

```bash
# 테스트 스테이지까지만 빌드 (테스트 실패 시 중단)
docker build --target test -t myapp:test .

# 프로덕션 이미지 빌드 (테스트 통과 필요)
docker build --target production -t myapp:prod .
```

테스트 코드와 개발 의존성이 프로덕션 이미지에 포함되지 않는다.

## 커버리지 보고서 추출

```bash
# 볼륨 마운트로 호스트에 보고서 추출
docker run --rm \
  -v $(pwd)/coverage:/app/coverage \
  myapp:test \
  pytest tests/ --cov=app --cov-report=xml:coverage/coverage.xml

# GitHub Actions에서 업로드
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage.xml
```

## GitHub Actions 완성 예제

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run unit tests
        run: |
          docker build --target test -t myapp:test .

      - name: Run integration tests
        run: |
          docker compose -f compose.test.yml up \
            --build --abort-on-container-exit \
            --exit-code-from app
          docker compose -f compose.test.yml down -v

      - name: Build production image
        if: success()
        run: docker build --target production -t myapp:prod .
```

## 테스트용 환경 변수 관리

```yaml
# compose.test.yml — env_file 사용
services:
  app:
    env_file:
      - .env.test     # 테스트 전용 설정
    build: .
```

```bash
# .env.test
DATABASE_URL=postgresql://test:test@db:5432/testdb
SECRET_KEY=test-secret-key-not-for-production
ENVIRONMENT=test
```

`.env.test`는 실제 시크릿 없이 테스트 전용 더미 값만 포함한다. `.gitignore`가 아니라 **저장소에 커밋**해도 무방하다.

## 병렬 테스트 분할 (pytest-xdist)

```bash
# 컨테이너 안에서 병렬 실행
docker run --rm myapp:test \
  pytest tests/ -n auto --dist=loadscope
```

`-n auto`는 CPU 코어 수만큼 워커를 생성한다. 테스트 수가 많을 때 큰 효과가 있다.

---

**지난 글:** [docker/build-push-action 완전 정복](/posts/docker-build-push-action/)

**다음 글:** [Docker로 개발 환경 구성하기](/posts/docker-dev-environments/)

<br>
읽어주셔서 감사합니다. 😊
