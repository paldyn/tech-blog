---
title: "docker system prune: 사용하지 않는 리소스 일괄 정리"
description: "docker system prune의 정리 대상, --all·--volumes 플래그, 개별 prune 명령어, --filter 조건부 삭제, CI 환경 자동화 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "prune", "system-prune", "디스크정리", "dangling", "빌드캐시", "정리"]
featured: false
draft: false
---

[지난 글](/posts/docker-storage-drivers/)에서 overlay2가 이미지 레이어를 디스크에 저장하는 방법을 살펴봤다. 이번에는 사용하지 않는 이미지, 컨테이너, 네트워크, 빌드 캐시를 한 번에 정리하는 `docker system prune`을 정리한다.

## docker system df로 현황 파악

prune 전에 먼저 무엇이 얼마나 공간을 차지하는지 확인한다.

```bash
docker system df
```

```text
TYPE            TOTAL   ACTIVE   SIZE      RECLAIMABLE
Images          24      5        8.432GB   6.1GB (72%)
Containers      12      3        245MB     234MB (95%)
Local Volumes   8       2        1.2GB     800MB (66%)
Build Cache     -       -        2.3GB     2.3GB
```

`-v` 플래그로 각 리소스별 상세 내역을 볼 수 있다.

## docker system prune 기본 동작

`docker system prune`은 다음 네 가지를 정리한다.

- **중지된 컨테이너** — `Status=Exited` 상태인 컨테이너
- **댕글링 이미지** — 태그가 없고 다른 이미지가 참조하지 않는 `<none>:<none>` 이미지
- **미사용 네트워크** — 어떤 컨테이너도 연결되지 않은 사용자 정의 네트워크 (`bridge`, `host`, `none`은 보호됨)
- **빌드 캐시** — BuildKit 레이어 캐시

```bash
docker system prune
```

실행하면 삭제 예정 목록을 보여주고 확인을 요청한다. `-f` 플래그로 확인 없이 실행한다.

![docker system prune 정리 대상](/assets/posts/docker-system-prune-targets.svg)

## --all: 미사용 이미지 전체 삭제

기본 prune은 댕글링 이미지만 삭제한다. `--all`(-a)을 추가하면 **실행 중인 컨테이너가 사용하지 않는 모든 이미지**를 삭제한다.

```bash
docker system prune --all
```

CI/CD 서버처럼 이미지를 자주 빌드하는 환경에서 오래된 이미지가 쌓이는 것을 막을 때 유용하다. 단, 다음에 같은 이미지가 필요하면 다시 pull해야 한다.

## --volumes: 볼륨 포함

기본적으로 볼륨은 prune 대상에서 제외된다. `--volumes`를 추가하면 어떤 컨테이너에도 마운트되지 않은 볼륨도 삭제한다.

```bash
docker system prune --volumes
```

**볼륨에는 데이터베이스 데이터, 파일 업로드 등이 있을 수 있으므로 주의한다.** 개발 환경이라도 중요한 데이터가 있는지 확인한 후 실행한다.

## 개별 prune 명령어

리소스 유형별로 선택적으로 정리할 수 있다.

![개별 prune 명령어](/assets/posts/docker-system-prune-individual.svg)

**컨테이너 정리**:

```bash
docker container prune
docker container prune -f   # 확인 없이
```

**이미지 정리**:

```bash
docker image prune          # 댕글링만
docker image prune -a       # 미사용 전체
```

**빌드 캐시 정리**:

```bash
docker builder prune
docker builder prune --all  # 사용 중인 캐시도 포함
docker builder prune --keep-storage=5g   # 5GB 이상만 삭제
```

## --filter로 조건 지정

생성 시간 기준으로 오래된 것만 삭제할 수 있다.

```bash
# 24시간 이전에 만든 이미지만 삭제
docker image prune -a --filter "until=24h"

# 특정 라벨이 있는 컨테이너만 삭제
docker container prune --filter "label=environment=test"

# 48시간 이전에 중지된 컨테이너만
docker container prune --filter "until=48h"
```

## CI 환경 자동화

빌드 서버에서 주기적으로 실행하면 디스크 고갈을 방지할 수 있다.

```bash
#!/bin/bash
# 매일 자정 실행 (cron: 0 0 * * *)

# 24시간 이전 리소스 정리 (확인 없이)
docker system prune -f --filter "until=24h"

# 빌드 캐시는 5GB까지 유지
docker builder prune -f --keep-storage=5g

# 결과 리포트
docker system df
```

CI 파이프라인에서는 빌드 완료 후 실행하는 것도 좋다.

```yaml
# GitHub Actions
- name: Clean up Docker
  if: always()
  run: docker system prune -f --filter "until=1h"
```

## 안전하게 삭제되는 것, 아닌 것

**안전하게 삭제됨**:
- 중지된 컨테이너
- 댕글링 이미지
- 사용하지 않는 빌드 캐시
- 빈 사용자 정의 네트워크

**삭제되지 않음 (기본)**:
- 실행 중인 컨테이너
- 마운트된 볼륨
- 태그가 있는 이미지 (`--all` 없이)
- `bridge`, `host`, `none` 네트워크

---

**지난 글:** [Docker 스토리지 드라이버: overlay2 완전 정복](/posts/docker-storage-drivers/)

**다음 글:** [Docker 디스크 정리: 공간 확보 완전 가이드](/posts/docker-disk-cleanup/)

<br>
읽어주셔서 감사합니다. 😊
