---
title: "docker image prune — 불필요한 이미지 정리"
description: "docker image prune으로 댕글링 이미지와 미사용 이미지를 정리하는 방법, -a·-f·--filter 옵션, 자동화 적용 시 주의사항, docker system prune과의 관계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "prune", "dangling", "정리", "cleanup"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-history/)에서 이미지의 레이어 구성을 분석하는 방법을 살펴봤다. 이번에는 불필요하게 쌓인 이미지를 한 번에 정리하는 `docker image prune`을 알아본다. 개발 환경에서는 빌드를 반복할수록 이전 이미지가 댕글링 상태로 쌓이고, CI/CD 파이프라인에서는 수십 GB의 디스크가 순식간에 소모될 수 있다. 올바른 prune 전략은 시스템을 건강하게 유지하는 필수 습관이다.

## 댕글링(Dangling) 이미지란?

태그가 없는 `<none>:<none>` 상태의 이미지를 댕글링 이미지라고 한다. 두 가지 경우에 발생한다.

- 같은 태그로 이미지를 재빌드하면 이전 이미지의 태그가 새 이미지로 이동하면서 이전 이미지가 `<none>`이 된다.
- 멀티 스테이지 빌드의 중간 스테이지도 이름 없이 남을 수 있다.

```bash
# 댕글링 이미지 확인
docker images --filter dangling=true

# 실제 출력 예시
# REPOSITORY  TAG    IMAGE ID      SIZE
# <none>      <none> c3d4e5f6a7b8  120MB
```

## 기본 사용법

```bash
# 댕글링 이미지만 삭제 (기본 동작)
docker image prune

# 확인 없이 즉시 삭제
docker image prune -f
```

기본 모드는 `<none>:<none>` 이미지만 대상으로 삼는다. 태그가 있는 이미지는 컨테이너 실행 여부와 관계없이 건드리지 않는다.

![prune 모드 비교](/assets/posts/docker-image-prune-modes.svg)

## -a: 미사용 이미지 전체 삭제

```bash
# 실행 중인 컨테이너에서 사용하지 않는 모든 이미지 삭제
docker image prune -a

# 확인 없이 전체 삭제
docker image prune -af
```

`-a` 옵션은 댕글링 이미지뿐 아니라 태그가 있지만 **현재 실행 중인 어떤 컨테이너도 사용하지 않는** 이미지까지 삭제한다. 주의할 점은 다음과 같다.

- 정지된 컨테이너의 이미지도 삭제 대상이 된다.
- 나중에 재사용할 이미지를 날려버리면 다시 pull해야 해 레지스트리 요금이나 rate limit 문제가 생길 수 있다.
- CI/CD 머신에서 빌드 캐시용 이미지를 실수로 지울 수 있다.

## --filter: 조건부 삭제

특정 시간 이전 이미지나 특정 라벨의 이미지만 삭제할 수 있다.

```bash
# 24시간 이전에 생성된 미사용 이미지만 삭제
docker image prune -a \
  --filter "until=24h"

# 특정 라벨이 있는 이미지만 삭제
docker image prune -a \
  --filter "label=env=dev"

# 48시간 이전 댕글링 이미지
docker image prune \
  --filter "until=48h"
```

`until`에는 `24h`, `2h30m`, `2006-01-02T15:04:05` 같은 형식을 사용할 수 있다.

![prune 명령 패턴](/assets/posts/docker-image-prune-commands.svg)

## docker system prune과의 관계

```bash
# 이미지만 정리
docker image prune

# 이미지 + 컨테이너 + 네트워크 + 빌드 캐시 전부
docker system prune

# 볼륨까지 포함
docker system prune --volumes
```

`docker system prune`은 여러 리소스를 한 번에 정리하지만 그만큼 위험도가 높다. 서비스 환경에서는 리소스별로 개별 prune을 사용하는 것이 더 안전하다.

## CI/CD 파이프라인에서의 활용

파이프라인 마지막에 정리 단계를 추가하면 빌드 머신의 디스크를 자동으로 관리할 수 있다.

```bash
# GitHub Actions 예시 (워크플로 마지막 step)
- name: Cleanup Docker images
  run: docker image prune -f
  if: always()  # 빌드 실패해도 정리
```

`-f`로 대화형 확인을 건너뛰는 것이 CI 환경에서 필수다. `-a`는 빌드 캐시를 날려 다음 빌드가 느려질 수 있으므로 신중하게 결정한다.

## 삭제된 용량 확인

`prune` 명령은 실행 후 삭제된 이미지 수와 회수된 용량을 출력한다.

```text
Deleted Images:
untagged: <none>@sha256:abc...
deleted:  sha256:abc...

Total reclaimed space: 1.23GB
```

정기적인 정리로 확보한 용량을 모니터링하면 인프라 비용 절감 효과를 측정할 수 있다.

---

**지난 글:** [docker image history — 이미지 레이어 이력 조회](/posts/docker-image-history/)

**다음 글:** [docker image save/load — 이미지 파일 저장·불러오기](/posts/docker-image-save-load/)

<br>
읽어주셔서 감사합니다. 😊
