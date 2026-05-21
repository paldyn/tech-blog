---
title: "Docker Slim과 이미지 최적화 도구 활용법"
description: "docker-slim(slimtoolkit), dive, crane 등 이미지 크기 최적화 도구의 원리, 설치, 사용법과 CI 통합 방법을 실전 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "slim", "dive", "crane", "이미지최적화", "레이어", "CI", "도구"]
featured: false
draft: false
---

[지난 글](/posts/docker-scratch-image/)에서 scratch 이미지로 최소 크기를 달성하는 방법을 다뤘다. 하지만 모든 앱을 scratch로 전환하는 건 현실적으로 어렵다. 이미 빌드된 이미지를 자동으로 줄여주는 도구들이 있다 — `docker-slim`, `dive`, `crane`이 대표적이다.

## docker-slim: 동적 분석 기반 자동 최적화

`docker-slim`(현재 이름: `slimtoolkit`)은 컨테이너를 실제로 실행하면서 어떤 파일을 사용하는지 동적으로 프로파일링한다. 그리고 사용된 파일만 새 이미지에 담는다.

동작 원리:
1. 원본 이미지로 컨테이너를 시작
2. ptrace/eBPF로 파일 접근을 모니터링
3. HTTP 프로브나 사용자 정의 테스트를 실행
4. 접근된 파일만으로 최소 이미지 생성

```bash
# 설치
curl -sL https://raw.githubusercontent.com/slimtoolkit/slim/master/scripts/install-slim.sh | sudo bash

# 또는 Docker 이미지로 실행
docker run -it --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  slimtoolkit/slim build myapp:latest
```

![이미지 최적화 도구 비교](/assets/posts/docker-slim-tools-overview.svg)

### 기본 사용법

```bash
# 기본 빌드 (HTTP 프로브로 동적 분석)
slim build --http-probe myapp:latest

# 결과 확인
docker images | grep myapp
# myapp        latest      ...    400MB
# myapp.slim   latest      ...    12MB   ← 자동 생성됨

# 특정 태그로 출력
slim build --tag myapp:slim myapp:latest

# 포트 지정 (앱이 8080이 아닌 다른 포트를 쓸 경우)
slim build --http-probe-cmd "GET http://localhost:3000/health" myapp:latest
```

### 주의사항

docker-slim은 테스트 중 실행된 코드 경로만 포함하므로, 테스트 커버리지가 낮으면 프로덕션에서 오류가 발생할 수 있다. CI에서 충분한 엔드포인트를 프로브하고, 슬림 이미지로 통합 테스트를 별도로 실행해야 한다.

```bash
# 여러 경로 프로브
slim build \
  --http-probe-cmd "GET http://localhost:8080/" \
  --http-probe-cmd "GET http://localhost:8080/health" \
  --http-probe-cmd "POST http://localhost:8080/api/data" \
  myapp:latest
```

## dive: 레이어 시각화 도구

`dive`는 Docker 이미지의 각 레이어를 시각화하고, 어떤 파일이 어떤 레이어에서 추가/수정/삭제됐는지 보여주는 TUI 도구다. 이미지를 직접 수정하지는 않지만, 불필요한 파일을 찾아 Dockerfile을 개선하는 데 필수적이다.

![docker-slim 주요 사용법](/assets/posts/docker-slim-tools-usage.svg)

```bash
# 설치 (Linux)
wget https://github.com/wagoodman/dive/releases/latest/download/dive_linux_amd64.tar.gz
tar -xzf dive_linux_amd64.tar.gz
sudo mv dive /usr/local/bin/

# 또는 Docker로
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive:latest myapp:latest
```

### CI에서 효율성 검사

```bash
# 이미지 효율성 95% 미만이면 빌드 실패
CI=true dive myapp:latest

# 환경변수로 기준 조정
DIVE_CI_LOWEST_EFFICIENCY=0.90 dive --ci myapp:latest
```

dive가 보여주는 "Image efficiency score"는 전체 이미지 크기 대비 실제 파일 크기 비율이다. 100%에 가까울수록 불필요하게 낭비되는 레이어가 없다는 의미다.

## crane: 이미지 조작 CLI

`crane`은 Google의 `go-containerregistry` 프로젝트에서 제공하는 CLI로, 이미지를 데몬 없이 직접 조작할 수 있다. 레이어 병합(`flatten`), 이미지 복사, 태그 관리 등에 유용하다.

```bash
# 설치
go install github.com/google/go-containerregistry/cmd/crane@latest

# 이미지 정보 확인
crane manifest myapp:latest | python3 -m json.tool

# 레이어 수 확인
crane manifest myapp:latest | python3 -c "
import json, sys
m = json.load(sys.stdin)
print(f'레이어 수: {len(m[\"layers\"])}')
total = sum(l[\"size\"] for l in m[\"layers\"])
print(f'압축 크기: {total/1024/1024:.1f}MB')
"

# 여러 레이어를 단일 레이어로 병합 (flatten)
crane flatten myapp:latest -t myapp:flat
```

레이어 병합은 이미지 크기를 줄이지는 않지만, 레이어 수를 줄여 pull 성능을 높이고 `docker history`의 가독성을 개선한다.

## 실전 최적화 파이프라인

세 도구를 조합하면 다음과 같은 최적화 파이프라인을 구성할 수 있다.

```bash
#!/bin/bash
set -e

IMAGE="myapp:latest"
SLIM_IMAGE="myapp:slim"

echo "1. dive로 레이어 분석"
dive --ci "$IMAGE" || { echo "Efficiency score too low, fix Dockerfile first"; exit 1; }

echo "2. slim으로 이미지 최적화"
slim build --tag "$SLIM_IMAGE" --http-probe "$IMAGE"

echo "3. 크기 비교"
ORIG=$(docker inspect "$IMAGE" --format='{{.Size}}')
SLIM=$(docker inspect "$SLIM_IMAGE" --format='{{.Size}}')
echo "Original: $(($ORIG / 1024 / 1024))MB → Slim: $(($SLIM / 1024 / 1024))MB"

echo "4. 슬림 이미지 기본 동작 확인"
docker run --rm "$SLIM_IMAGE" --version || true
```

## 각 도구 선택 기준

Dockerfile을 개선해서 줄이는 것이 우선이지만, 서드파티 베이스 이미지처럼 Dockerfile 수정이 어려운 경우 docker-slim이 효과적이다. dive는 개발 단계에서 레이어 분석 습관을 들이는 데 좋고, crane은 CI/CD에서 이미지를 프로그래밍 방식으로 다룰 때 유용하다.

---

**지난 글:** [Scratch 이미지: 절대 최소 컨테이너 만들기](/posts/docker-scratch-image/)

**다음 글:** [BuildKit 캐시 마운트: RUN --mount=type=cache 완전 정복](/posts/docker-build-cache-mount/)

<br>
읽어주셔서 감사합니다. 😊
