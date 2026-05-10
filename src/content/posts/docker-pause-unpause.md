---
title: "docker pause / unpause — 컨테이너 일시 정지"
description: "docker pause와 unpause 명령의 동작 원리인 cgroup freezer를 이해하고, 일관된 스냅샷 백업, 리소스 확보, 디버깅 등 실전 사용 사례와 stop과의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "pause", "unpause", "cgroup", "freezer"]
featured: false
draft: false
---

[지난 글](/posts/docker-cp/)에서 호스트와 컨테이너 간 파일 복사를 살펴봤다. 이번에는 컨테이너를 종료하지 않고 **일시 정지**할 수 있는 `docker pause`와 `docker unpause`를 알아본다. 단순해 보이지만 내부 메커니즘과 활용 패턴을 이해하면 백업·디버깅·리소스 관리에 강력한 도구가 된다.

## cgroup freezer 원리

`docker pause`는 컨테이너 내 프로세스에 `SIGSTOP` 시그널을 보내는 것이 아니다. Linux **cgroup freezer 서브시스템**을 사용해 컨테이너에 속한 모든 프로세스를 원자적으로 동결한다.

```bash
# pause 후 cgroup 상태 확인 (개념 예시)
cat /sys/fs/cgroup/freezer/<container-id>/freezer.state
# FROZEN

# unpause 후
cat /sys/fs/cgroup/freezer/<container-id>/freezer.state
# THAWED
```

cgroup freezer의 핵심 장점은 **멀티스레드 프로세스도 모든 스레드가 동시에 동결**된다는 것이다. SIGSTOP을 개별 PID에 전송하면 스레드 간 타이밍 차이가 생길 수 있지만, freezer는 이런 문제가 없다.

![cgroup freezer 동작 원리](/assets/posts/docker-pause-cgroups-freezer.svg)

## 기본 사용법

```bash
# 컨테이너 일시 정지
docker pause <CONTAINER>

# 일시 정지 해제
docker unpause <CONTAINER>

# 정지된 컨테이너 목록 확인
docker ps --filter 'status=paused'
```

`docker ps`에서 STATUS 컬럼은 `Up X minutes (Paused)`로 표시된다.

## pause vs stop

|  | pause | stop |
|--|-------|------|
| 메모리 | 보존 | 해제 |
| 파일 핸들 | 유지 | 닫힘 |
| 소켓 연결 | 유지 | 끊어짐 |
| 재개 방법 | unpause (즉시) | start (재시작) |
| 프로세스 상태 | 동결 | 종료 |

pause는 컨테이너가 살아있는 채로 시간을 멈추는 것과 같다. 소켓 연결이 끊어지지 않으므로 unpause 후 이전 상태에서 정확히 이어진다.

![pause / unpause 명령 패턴](/assets/posts/docker-pause-commands.svg)

## 실전 활용

**일관된 백업 스냅샷:**

데이터베이스 컨테이너를 pause하면 쓰기가 완전히 중단되므로, 이 시점에 파일시스템 스냅샷을 찍으면 일관성 있는 백업을 얻을 수 있다.

```bash
docker pause db
# 파일시스템 스냅샷 (btrfs/LVM 등)
snapshot_volume /var/lib/docker/volumes/db_data
docker unpause db
```

pause 시간을 최소화해 서비스 영향을 줄이는 것이 중요하다.

**리소스 임시 확보:**

무거운 배치 작업이 CPU를 잠시 독점해야 할 때, 다른 컨테이너를 일시 정지해 리소스를 양보받을 수 있다.

```bash
docker pause background-worker
run_heavy_batch
docker unpause background-worker
```

**디버깅 목적 동결:**

특정 시점의 컨테이너 상태를 분석하고 싶을 때 pause로 동결하고 `docker exec`로 진입해 파일시스템이나 환경 변수를 검사할 수 있다.

```bash
docker pause myapp
docker exec -it myapp /bin/sh
# 파일시스템, 환경 변수, /proc 등 분석
docker unpause myapp
```

## 주의 사항

pause 상태에서는 컨테이너가 **헬스체크 요청에 응답하지 않는다**. 헬스체크 타임아웃이 짧게 설정되어 있으면 unhealthy로 마킹될 수 있고, 이것이 오케스트레이터의 재시작 트리거가 될 수 있다. 운영 환경에서 pause를 사용할 때는 헬스체크 설정을 확인해야 한다.

또한 네트워크 측에서 보면 pause된 컨테이너는 응답이 없는 것처럼 보이므로, 로드 밸런서가 해당 인스턴스를 제외시킬 수 있다.

---

**지난 글:** [docker cp — 컨테이너와 호스트 간 파일 복사](/posts/docker-cp/)

**다음 글:** [docker rename — 컨테이너 이름 변경](/posts/docker-rename/)

<br>
읽어주셔서 감사합니다. 😊
