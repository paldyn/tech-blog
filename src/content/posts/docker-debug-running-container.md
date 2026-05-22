---
title: "실행 중인 컨테이너 디버깅 전략"
description: "docker logs, exec, inspect, stats, top, nsenter, debug 컨테이너를 활용해 실행 중인 컨테이너 문제를 진단하는 방법을 상황별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "debug", "logs", "exec", "inspect", "nsenter", "디버깅", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-signing-cosign/)에서 이미지 서명으로 공급망 보안을 강화하는 방법을 살펴봤다. 이번엔 반대편 — 이미 실행 중인 컨테이너에서 문제가 생겼을 때 어떻게 진단하는지를 다룬다.

컨테이너는 격리된 환경이라 호스트에서 직접 접근하기 어렵다. 하지만 Docker는 이를 위한 다양한 도구를 제공한다.

## 디버깅 도구 전체 지형도

![실행 중인 컨테이너 디버깅 도구](/assets/posts/docker-debug-running-container-tools.svg)

## 1단계: 컨테이너 상태 확인

문제가 발생하면 먼저 컨테이너 상태부터 확인한다.

```bash
# 모든 컨테이너 상태 확인 (종료된 것 포함)
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 종료 코드 확인
docker inspect myapp --format '{{.State.ExitCode}} {{.State.Error}}'
# 0: 정상 / 1: 애플리케이션 오류 / 137: OOM 또는 SIGKILL / 139: Segfault

# 재시작 횟수 확인 (CrashLoop 의심)
docker inspect myapp --format '{{.RestartCount}}'
```

종료 코드 137(= 128 + SIGKILL)은 OOM Killer가 프로세스를 죽였거나 `docker kill`이 호출됐을 때 나타난다.

## 2단계: 로그 분석

```bash
# 마지막 100줄 + 타임스탬프
docker logs --tail=100 --timestamps myapp

# 실시간 팔로우
docker logs -f myapp

# 에러만 필터
docker logs myapp 2>&1 | grep -i "error\|exception\|fatal"

# 특정 시간 이후 로그
docker logs --since="2026-05-23T10:00:00" myapp

# 이전 컨테이너 로그 (재시작된 경우)
docker logs --previous myapp 2>/dev/null || docker logs myapp
```

컨테이너가 이미 종료됐어도 로그 드라이버가 `json-file`인 경우 로그가 남아 있다.

## 3단계: 리소스 사용량

```bash
# 스냅샷 형태로 통계 조회
docker stats --no-stream myapp

# 실시간 모니터링
docker stats myapp

# 컨테이너 내 프로세스 목록
docker top myapp aux
# 출력에서 PID는 호스트 PID namespace 기준
```

`MEM USAGE`가 `MEM LIMIT`에 근접하면 OOM 위험 신호다.

## 4단계: 내부 진입 (exec)

![컨테이너 디버깅 절차 흐름도](/assets/posts/docker-debug-running-container-flow.svg)

```bash
# bash 또는 sh로 진입
docker exec -it myapp bash
docker exec -it myapp sh  # bash 없을 때

# 단발성 명령 실행
docker exec myapp ps aux
docker exec myapp cat /etc/hosts
docker exec myapp env | sort
docker exec myapp ls -la /app

# 루트로 접속 (컨테이너가 non-root로 실행 중일 때)
docker exec -it --user root myapp bash
```

## 5단계: 상세 메타데이터 (inspect)

```bash
# 전체 정보 JSON
docker inspect myapp

# 환경변수 확인
docker inspect myapp --format '{{range .Config.Env}}{{println .}}{{end}}'

# IP 주소 및 네트워크
docker inspect myapp --format '{{.NetworkSettings.IPAddress}}'
docker inspect myapp --format '{{json .NetworkSettings.Networks}}' | jq .

# 마운트 정보
docker inspect myapp --format '{{json .Mounts}}' | jq .

# 헬스체크 결과
docker inspect myapp --format '{{json .State.Health}}' | jq .
```

## 셸 없는 컨테이너 디버깅: nsenter

distroless 이미지처럼 셸이 없는 컨테이너는 `docker exec`로 진입할 수 없다. `nsenter`를 사용하면 컨테이너의 네임스페이스에 호스트 도구를 들고 들어갈 수 있다.

```bash
# 컨테이너 PID 조회
PID=$(docker inspect --format '{{.State.Pid}}' myapp)

# 컨테이너 네임스페이스로 진입 (호스트에서 실행)
nsenter --target "$PID" --mount --uts --ipc --net --pid -- sh

# 네트워크 네임스페이스만 진입 (IP 확인용)
nsenter --target "$PID" --net -- ip addr show
nsenter --target "$PID" --net -- ss -tlnp
```

## docker debug (Docker Desktop 4.27+)

Docker Desktop은 공식 `docker debug` 명령으로 임시 디버그 컨테이너를 주입한다. distroless/scratch 이미지도 디버깅 가능하다.

```bash
# 디버그 컨테이너 시작
docker debug myapp

# 특정 도구가 포함된 이미지로 디버깅
docker debug --image=nicolaka/netshoot myapp
```

## Kubernetes에서 임시 컨테이너

Kubernetes 1.23+에서는 `kubectl debug`로 실행 중인 파드에 임시 컨테이너를 삽입할 수 있다.

```bash
# 임시 컨테이너 추가 (같은 네임스페이스 공유)
kubectl debug -it mypod \
  --image=nicolaka/netshoot \
  --target=myapp-container

# 파드 복사본 생성 (원본 유지하면서 디버깅)
kubectl debug mypod \
  -it --image=ubuntu \
  --copy-to=debug-pod \
  --share-processes
```

`nicolaka/netshoot`은 네트워크 디버깅 도구(curl, dig, tcpdump, iperf3 등)를 포함한 유용한 디버그 이미지다.

## 파일시스템 스냅샷

실행 중인 컨테이너의 파일시스템을 호스트로 복사해 분석할 수 있다.

```bash
# 특정 파일 복사
docker cp myapp:/app/logs/error.log ./error.log

# 컨테이너 파일시스템 전체 덤프
docker export myapp | tar -xf - -C ./container-fs/

# 변경된 파일 확인 (이미지 대비 diff)
docker diff myapp
# A: Added / C: Changed / D: Deleted
```

---

**지난 글:** [Cosign으로 Docker 이미지 서명하기](/posts/docker-image-signing-cosign/)

**다음 글:** [실패한 컨테이너 원인 분석하기](/posts/docker-debug-failed-container/)

<br>
읽어주셔서 감사합니다. 😊
