---
title: "docker top — 컨테이너 내부 프로세스 확인"
description: "docker top 명령으로 컨테이너 내부 프로세스를 호스트 PID 기준으로 조회하는 방법, ps 옵션 전달, exec ps와의 차이, 그리고 nsenter 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker top", "프로세스", "PID", "nsenter", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/docker-stats/)에서 컨테이너의 리소스 사용량을 실시간으로 확인하는 방법을 살펴봤습니다. 이번에는 컨테이너 내부에서 실행 중인 **프로세스 목록**을 확인하는 `docker top`을 다룹니다.

## docker top이란?

```bash
docker top web       # 컨테이너 web의 프로세스 목록
docker top web aux   # ps aux 형식으로 출력
```

`docker top`은 호스트의 `ps` 명령을 컨테이너 프로세스에 적용해 결과를 보여줍니다. 컨테이너 내부에 `ps` 명령이 없어도 동작하는 것이 특징입니다.

![docker top 출력 구조](/assets/posts/docker-top-output.svg)

## PID 네임스페이스 이해

`docker top`이 보여주는 PID는 **호스트 PID 네임스페이스** 기준입니다. 컨테이너 내부에서 PID 1로 보이는 프로세스가 호스트에서는 12345 같은 큰 숫자로 보입니다.

![docker top vs exec ps](/assets/posts/docker-top-vs-ps.svg)

두 명령의 차이를 요약하면 다음과 같습니다.

| 항목 | docker top | docker exec ps |
|------|------------|----------------|
| PID 기준 | 호스트 네임스페이스 | 컨테이너 네임스페이스 |
| ps 설치 필요 | ✗ | ✓ |
| Distroless 동작 | ✓ | ✗ |
| nsenter용 PID | ✓ (호스트 PID) | ✗ |

## ps 옵션 전달

`docker top` 뒤에 `ps` 옵션을 그대로 전달할 수 있습니다.

```bash
# 기본 (ps -ef 형식)
docker top web

# aux 형식 (CPU, MEM 컬럼 포함)
docker top web aux

# 메모리 내림차순 정렬
docker top web aux --sort=-%mem

# 특정 프로세스만 (grep 조합)
docker top web aux | grep nginx
```

## 컨테이너 PID 1 확인

컨테이너의 메인 프로세스(PID 1)가 무엇인지 확인하는 것은 트러블슈팅의 출발점입니다.

```bash
# PID 1만 추출
docker top web | awk 'NR==2 {print $2, $NF}'

# docker inspect로도 확인 가능
docker inspect -f '{{.State.Pid}}' web
```

## nsenter와 함께 사용

`docker top`으로 얻은 호스트 PID를 이용해 `nsenter`로 컨테이너 네임스페이스에 진입할 수 있습니다. `docker exec`가 불가능한 Distroless 컨테이너 디버깅에 유용합니다.

```bash
# 1. 호스트 PID 확인
PID=$(docker inspect -f '{{.State.Pid}}' web)

# 2. 컨테이너 네임스페이스에 bash로 진입
nsenter -t $PID --net --pid --mount --uts bash

# 3. 네트워크 네임스페이스만 진입
nsenter -t $PID --net ip addr
```

## 좀비 프로세스 탐지

PID 1이 자식 프로세스를 제대로 `wait()`하지 않으면 좀비 프로세스가 쌓입니다. `docker top`에서 `Z` 상태(STAT 컬럼)를 확인합니다.

```bash
docker top web aux | grep ' Z '
```

좀비 프로세스가 있으면 PID 1 프로세스가 신호를 제대로 처리하지 못하는 것입니다. `--init` 플래그를 추가해 tini를 PID 1로 사용하면 해결됩니다.

```bash
docker run --init myapp
```

## 정리

`docker top`은 컨테이너 내부 도구가 없어도 프로세스를 확인할 수 있는 간단하고 강력한 명령입니다. 호스트 PID를 반환하므로 `nsenter`, `strace`, `perf` 같은 호스트 도구와 조합해 심층 디버깅이 가능합니다.

---

**지난 글:** [docker stats — 실시간 리소스 모니터링](/posts/docker-stats/)

**다음 글:** [docker events — 실시간 Docker 이벤트 스트리밍](/posts/docker-events/)

<br>
읽어주셔서 감사합니다. 😊
