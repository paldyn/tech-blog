---
title: "Docker 디스크 정리: 공간 확보 완전 가이드"
description: "/var/lib/docker 구성, docker system df로 현황 파악, 단계별 prune 전략, 로그 파일 누적 해결, 이미지 크기 최적화로 디스크 공간을 효율적으로 관리하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "disk", "cleanup", "prune", "디스크정리", "space", "overlay2"]
featured: false
draft: false
---

[지난 글](/posts/docker-system-prune/)에서 `docker system prune`으로 미사용 리소스를 정리하는 방법을 살펴봤다. 이번에는 Docker가 디스크를 어떻게 쓰는지 전체 그림을 이해하고, 상황별로 공간을 회수하는 구체적인 전략을 정리한다.

## /var/lib/docker 구조

Docker의 루트 디렉터리는 `docker info | grep "Docker Root Dir"`으로 확인한다. 기본값은 `/var/lib/docker`다.

```bash
du -sh /var/lib/docker/*/
```

주요 하위 디렉터리:

- `overlay2/` — 이미지 및 컨테이너 레이어. **보통 가장 큰 영역**이다. 이미지 레이어와 실행 중인 컨테이너의 writable layer가 모두 여기 있다.
- `volumes/` — `docker volume create`로 만든 named volume 데이터
- `containers/` — 컨테이너 메타데이터 + 로그 파일(`*-json.log`)
- `buildkit/` — BuildKit 빌드 캐시
- `image/` — 이미지 메타데이터 및 manifest

![Docker 디스크 구성](/assets/posts/docker-disk-cleanup-flow.svg)

## 현황 파악

```bash
# 요약
docker system df

# 상세 (이미지·컨테이너·볼륨 각각의 크기)
docker system df -v
```

`RECLAIMABLE` 컬럼이 회수 가능한 공간이다. 이 값이 크면 prune으로 공간을 확보할 수 있다.

## 단계별 정리

급하게 디스크를 확보해야 할 때 안전한 것부터 순서대로 실행한다.

**1단계 — 중지된 컨테이너 삭제:**

```bash
docker container prune -f
```

종료된 컨테이너의 writable layer와 로그 파일이 함께 삭제된다.

**2단계 — 댕글링 이미지 삭제:**

```bash
docker image prune -f
```

빌드 중 생성된 태그 없는 레이어들을 삭제한다.

**3단계 — 빌드 캐시 정리:**

```bash
docker builder prune --keep-storage=2g -f
```

`--keep-storage`로 최근에 사용한 캐시 2GB는 남기고 나머지를 삭제한다. CI 서버에서 자주 빌드하면 빌드 캐시가 수 GB씩 쌓인다.

**4단계 — 미사용 이미지 전체 삭제:**

```bash
docker image prune -a -f
```

사용 중이 아닌 모든 이미지를 삭제한다. 다음 배포 시 pull이 필요하다.

**5단계 — 전체 정리:**

```bash
docker system prune -af
```

volumes까지 삭제하려면 `--volumes`를 추가하지만, 데이터 손실 위험이 있으므로 신중하게 사용한다.

## 로그 파일 누적 해결

json-file 드라이버를 로테이션 없이 사용하면 `containers/` 안의 `*-json.log` 파일이 무한히 커진다.

![로그 파일 디스크 회수](/assets/posts/docker-disk-cleanup-logs.svg)

실행 중인 컨테이너의 로그 파일을 비울 때는 파일을 삭제하면 안 된다. Docker daemon이 파일 핸들을 열고 있으므로 `truncate`로 내용만 지운다.

```bash
# 특정 컨테이너 로그 비우기
truncate -s 0 $(docker inspect --format='{{.LogPath}}' <container>)

# 모든 컨테이너 로그 한번에 비우기
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

**근본 해결책** — `daemon.json`에 로테이션을 설정하거나, Compose `logging` 블록에서 `max-size`를 지정한다.

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

## 이미지 크기 줄이기

디스크를 계속 쓰는 이유가 이미지 자체가 너무 크기 때문일 수도 있다.

```bash
# 이미지별 크기 순 정렬
docker image ls --format "{{.Size}}\t{{.Repository}}:{{.Tag}}" | sort -h -r | head -20
```

크기를 줄이는 빠른 방법:

- `alpine` 기반 이미지 사용 (수백 MB → 수 MB)
- 멀티 스테이지 빌드로 빌드 도구 제외
- `RUN` 레이어를 합쳐 중간 파일 제거

```dockerfile
# 나쁜 예
RUN apt-get update
RUN apt-get install -y build-essential
RUN make
RUN rm -rf /tmp/build

# 좋은 예 (레이어 하나에 처리)
RUN apt-get update && apt-get install -y build-essential \
    && make && rm -rf /tmp/build \
    && apt-get purge -y build-essential && apt-get autoremove -y
```

## 디스크 알림 설정

디스크가 가득 차서 컨테이너가 시작되지 않는 상황을 예방하려면 호스트 디스크 사용률 모니터링을 설정한다.

```bash
# 크론으로 주기적 확인
0 */4 * * * docker system prune -f --filter "until=24h" >> /var/log/docker-prune.log 2>&1
```

---

**지난 글:** [docker system prune: 사용하지 않는 리소스 일괄 정리](/posts/docker-system-prune/)

**다음 글:** [Docker 보안 개요: 컨테이너 보안의 핵심 원칙](/posts/docker-security-overview/)

<br>
읽어주셔서 감사합니다. 😊
