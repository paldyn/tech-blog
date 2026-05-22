---
title: "컨테이너에 셸로 접속하기: exec, attach, nsenter"
description: "docker exec, attach, nsenter, debug 컨테이너를 이용해 실행 중인 컨테이너에 셸로 접속하는 다양한 방법과 각 방식의 차이점, distroless/scratch 컨테이너 접속 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "exec", "attach", "nsenter", "shell", "distroless", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/docker-debug-failed-container/)에서 실패한 컨테이너를 분석하는 방법을 다뤘다. 디버깅 과정에서 가장 자주 하는 작업 중 하나가 컨테이너 내부로 셸 접속이다. 방법이 여러 가지이고 각각 동작 방식이 달라 혼동하기 쉽다.

## 방법 비교

![컨테이너 접속 방법 비교](/assets/posts/docker-shell-into-methods.svg)

## docker exec: 가장 일반적인 방법

```bash
# 새 bash 세션으로 진입
docker exec -it myapp bash

# bash 없는 이미지 (alpine 등)
docker exec -it myapp sh
docker exec -it myapp /bin/sh

# 특정 사용자로 접속
docker exec -it --user root myapp bash
docker exec -it --user 1000 myapp bash

# 환경변수 추가
docker exec -it -e DEBUG=1 myapp bash

# 작업 디렉터리 지정
docker exec -it --workdir /app myapp bash
```

`-i`는 stdin을 열고, `-t`는 TTY를 할당한다. 둘 다 있어야 인터랙티브 셸이 동작한다. `-d`를 쓰면 백그라운드에서 실행된다.

```bash
# 단발성 명령 (TTY 없이)
docker exec myapp cat /etc/passwd
docker exec myapp ps aux
docker exec myapp netstat -tlnp 2>/dev/null || docker exec myapp ss -tlnp
```

## docker attach: PID 1에 연결

```bash
docker attach myapp
```

`exec`과 달리 `attach`는 새 프로세스를 만들지 않고 컨테이너의 PID 1(ENTRYPOINT 프로세스)의 stdin/stdout/stderr에 직접 연결한다.

주의: `Ctrl+C`를 누르면 SIGINT가 PID 1에 전달되어 **컨테이너가 종료**된다. `Ctrl+P, Ctrl+Q` 순서로 눌러야 컨테이너를 종료하지 않고 분리된다.

실무에서는 `exec`이 훨씬 안전하다. `attach`는 PID 1의 stdout을 모니터링할 때만 사용한다.

## nsenter: 셸 없는 컨테이너 진입

![distroless/scratch 컨테이너 접속 패턴](/assets/posts/docker-shell-into-distroless.svg)

distroless나 scratch 이미지는 `/bin/sh`조차 없어 `docker exec`으로 진입이 불가능하다. `nsenter`는 호스트에서 컨테이너의 네임스페이스로 직접 들어간다.

```bash
# 컨테이너 PID 1 조회
PID=$(docker inspect --format '{{.State.Pid}}' myapp)
echo "Container PID: $PID"

# 전체 네임스페이스 진입 (호스트 sh 사용)
sudo nsenter --target "$PID" --mount --uts --ipc --net --pid -- /bin/sh

# 네트워크 네임스페이스만 진입
sudo nsenter --target "$PID" --net -- ss -tlnp
sudo nsenter --target "$PID" --net -- ip route show

# 마운트 네임스페이스에서 파일 확인
sudo nsenter --target "$PID" --mount -- ls -la /app/
```

`nsenter`는 호스트에 설치된 도구(`/bin/sh`, `ss`, `ip` 등)를 컨테이너 네임스페이스 안에서 사용한다. 도커 데몬을 우회하므로 컨테이너에 아무 도구가 없어도 된다.

## 네임스페이스 공유 sidecar 컨테이너

nsenter 없이 같은 방식을 Docker 수준에서 구현하려면 `--pid`, `--network` 플래그로 네임스페이스를 공유하는 sidecar 컨테이너를 실행한다.

```bash
# 같은 PID/네트워크 네임스페이스로 디버그 컨테이너 실행
docker run -it --rm \
  --pid container:myapp \
  --network container:myapp \
  --volumes-from myapp \
  nicolaka/netshoot

# 내부에서 myapp의 프로세스 목록 확인 가능
ps aux
# 네트워크 확인
ss -tlnp; tcpdump -i eth0 -n
```

`nicolaka/netshoot`은 curl, dig, tcpdump, iperf3, ss, nmap 등 네트워크 디버깅 도구를 포함한 이미지다.

## docker debug (Docker Desktop)

Docker Desktop 4.27 이상에서는 공식 `docker debug` 명령을 지원한다.

```bash
# 기본 디버그 컨테이너 시작 (busybox 기반)
docker debug myapp

# 특정 이미지 사용
docker debug --image nicolaka/netshoot myapp

# 디버그 컨테이너에서 사용 가능한 도구 확인
docker debug myapp -- which ps curl wget
```

내부적으로 distroless 이미지에서도 동작하며, 공유 파일시스템으로 컨테이너 내부 파일에 접근할 수 있다.

## Kubernetes에서 임시 컨테이너

```bash
# 이미 실행 중인 파드에 임시 컨테이너 추가
kubectl debug -it mypod \
  --image=nicolaka/netshoot \
  --target=myapp-container

# 파드 복사본 생성 (원본 변경 없이)
kubectl debug mypod \
  -it \
  --image=ubuntu \
  --copy-to=debug-mypod \
  --share-processes

# 복사본의 컨테이너 이미지 교체 (원본 이미지 → ubuntu)
kubectl debug mypod \
  -it \
  --copy-to=debug-mypod \
  --container=myapp-container \
  --image=ubuntu
```

## 셸 선택 팁

```bash
# 어떤 셸이 있는지 확인
docker exec myapp cat /etc/shells 2>/dev/null || \
  docker exec myapp ls /bin/*sh

# 셸 없는 컨테이너에서 python을 셸 대신 사용
docker exec -it myapp python3

# busybox sh (경량)
docker exec -it myapp /busybox/sh
```

일부 이미지는 `/bin/bash`가 없고 `/bin/sh`만 있다. alpine은 ash를 sh 심볼릭 링크로 사용하므로 `sh`를 시도하면 된다.

---

**지난 글:** [실패한 컨테이너 원인 분석하기](/posts/docker-debug-failed-container/)

**다음 글:** [strace로 컨테이너 시스템콜 추적하기](/posts/docker-strace-attach/)

<br>
읽어주셔서 감사합니다. 😊
