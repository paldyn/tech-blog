---
title: ".dockerignore — 빌드 컨텍스트를 최소화하는 방법"
description: ".dockerignore의 역할과 빌드 컨텍스트 개념, 패턴 문법(글로브·부정 패턴), Node.js·Python·Go별 실전 예시, 캐시 안정성 향상과 시크릿 노출 방지 팁을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerignore", "빌드최적화", "보안", "빌드컨텍스트", "캐시"]
featured: false
draft: false
---

[지난 글](/posts/docker-devcontainer/)에서 Dev Containers로 팀 개발 환경을 표준화하는 방법을 살펴봤다. 개발 환경과 CI 어디서 `docker build`를 실행하든 **빌드 컨텍스트**가 너무 크면 느려진다. `.dockerignore`는 빌드 컨텍스트에서 제외할 파일과 디렉터리를 선언해 빌드 속도를 높이고 의도치 않은 파일 포함을 막는다.

## 빌드 컨텍스트란

`docker build .`을 실행하면 현재 디렉터리 전체가 Docker 데몬으로 전송된다. 이것이 **빌드 컨텍스트**다. `COPY` 명령은 이 컨텍스트에서 파일을 가져온다.

![빌드 컨텍스트와 .dockerignore 효과](/assets/posts/docker-dockerignore-context.svg)

컨텍스트가 크면 두 가지 문제가 생긴다. 첫째, 전송 시간이 길어져 빌드가 느려진다. 둘째, `.env`나 `*.pem` 같은 시크릿 파일이 빌드 레이어에 포함될 수 있다.

```bash
# 현재 컨텍스트 크기 확인
docker build --no-cache . 2>&1 | grep "Sending build context"
# Sending build context to Docker daemon  523.4MB

# .dockerignore 적용 후
# Sending build context to Docker daemon  1.8MB
```

## .dockerignore 문법

`.gitignore`와 동일한 glob 패턴을 사용한다.

```text
# 주석

# 특정 파일/디렉터리
node_modules
.env

# 와일드카드
*.log
*.tmp
**/*.test.js

# 재귀적 제외
**/node_modules

# 부정 패턴 (! 접두사) — 제외된 것에서 다시 포함
!src/

# 빈 줄 무시됨
```

## 언어별 실전 패턴

![.dockerignore 실전 패턴](/assets/posts/docker-dockerignore-patterns.svg)

**Node.js**

```text
# 의존성 (가장 중요 — 수백 MB)
node_modules

# 빌드 결과물 (컨테이너 안에서 새로 빌드)
dist
build
.next
.nuxt

# 개발 도구
.eslintcache
.parcel-cache

# 공통
.git
.gitignore
.dockerignore
.env
.env.*
**/*.log
coverage
.nyc_output
*.local
```

**Python**

```text
# 캐시 및 컴파일 파일
__pycache__
*.py[cod]
*$py.class
*.so

# 가상 환경
.venv
venv
env

# 테스트/커버리지
.pytest_cache
.mypy_cache
htmlcov
.coverage
coverage.xml

# 공통
.git
.env
.env.*
*.log
```

**Go**

```text
# 바이너리
*.exe
*.out

# 벤더 (go vendor 사용 시 제외 가능)
vendor/

# 테스트 파일 (prod 이미지에 불필요)
*_test.go
testdata/
*.test

# 공통
.git
.env
*.log
```

## 캐시 안정성을 위한 핵심 규칙

`.dockerignore`는 **레이어 캐시 안정성**에도 영향을 미친다. `node_modules`를 제외하지 않으면 의존성 파일이 변경되지 않아도 컨텍스트가 바뀌어 캐시가 무효화된다.

```dockerfile
FROM node:20-alpine
WORKDIR /app

# 이 레이어: package.json만 변경될 때 캐시 유지
COPY package*.json ./
RUN npm ci

# 이 레이어: 소스 변경 시에만 무효화
COPY src/ ./src/
RUN npm run build
```

`node_modules`가 컨텍스트에 포함되면 `COPY . .` 레이어가 매번 변경돼 `RUN npm ci` 캐시가 깨진다.

## 시크릿 파일 보호

`.dockerignore`가 없으면 `.env`나 인증서 파일이 빌드 레이어에 포함될 수 있다. 이미지를 레지스트리에 푸시하면 누구나 접근 가능해진다.

```text
# 절대로 포함되면 안 되는 파일들
.env
.env.*
*.pem
*.key
*.pfx
*.p12
id_rsa
id_ed25519
.aws
.kube
secrets/
```

```bash
# 이미지 레이어에 민감 파일이 있는지 확인
docker history myapp:latest
docker run --rm myapp:latest find / -name "*.env" 2>/dev/null
```

## 특정 파일만 포함하는 화이트리스트 패턴

큰 저장소에서 필요한 파일만 선택적으로 포함할 수 있다.

```text
# 모든 것을 제외하고
*

# 필요한 것만 다시 포함
!src/
!package*.json
!tsconfig.json
!Dockerfile
```

부정 패턴(`!`)은 반드시 제외 패턴 뒤에 써야 한다. 순서가 중요하다.

## .dockerignore 검증

```bash
# 어떤 파일이 컨텍스트에 포함되는지 확인
docker buildx build --no-cache --progress=plain . 2>&1 | grep "COPY\|ADD"

# 더 직접적인 방법: 임시 이미지로 확인
docker build -t test-context - << 'EOF'
FROM busybox
COPY . /context
EOF
docker run --rm test-context find /context -type f | head -50
```

---

**지난 글:** [VS Code Dev Containers로 팀 개발 환경 표준화하기](/posts/docker-devcontainer/)

**다음 글:** [Docker 데몬 연결 오류 해결하기](/posts/docker-cannot-connect-daemon/)

<br>
읽어주셔서 감사합니다. 😊
