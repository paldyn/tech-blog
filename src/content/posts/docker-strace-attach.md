---
title: "strace로 컨테이너 시스템콜 추적하기"
description: "strace를 이용해 Docker 컨테이너 내 프로세스의 시스템콜을 추적하는 방법, seccomp 우회, 파일/네트워크/프로세스 추적 시나리오, perf와 eBPF 도구 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "strace", "syscall", "디버깅", "성능분석", "seccomp", "ptrace", "eBPF"]
featured: false
draft: false
---

[지난 글](/posts/docker-shell-into/)에서 셸 접속 방법을 다뤘다. 셸로 진입해도 원인을 파악하기 어려운 경우가 있다. 예를 들어 어떤 파일을 읽으려다 실패하는지, 어떤 네트워크 주소로 연결을 시도하는지가 로그에 남지 않을 때 `strace`가 가장 직접적인 해답을 준다.

## strace란

`strace`는 리눅스 `ptrace` 시스템콜을 사용해 대상 프로세스의 모든 시스템콜(시스템 호출)을 가로채 출력하는 도구다. 프로세스가 OS 커널에 요청하는 파일 I/O, 네트워크, 프로세스 생성 등 모든 상호작용을 볼 수 있다.

![strace 컨테이너 시스템콜 추적](/assets/posts/docker-strace-attach-overview.svg)

## seccomp 프로파일 주의사항

Docker는 기본적으로 seccomp 프로파일을 적용해 일부 시스템콜을 차단한다. `ptrace`도 기본 프로파일에서는 제한된다. strace를 사용하려면 제한을 해제해야 한다.

```bash
# 방법 1: --cap-add SYS_PTRACE
docker run -d --cap-add SYS_PTRACE --name myapp myimage

# 방법 2: seccomp 비활성화 (더 넓은 허용)
docker run -d --security-opt seccomp=unconfined --name myapp myimage

# 실행 중인 컨테이너에는 적용 불가 — 재실행 필요
docker rm -f myapp
docker run -d --cap-add SYS_PTRACE --name myapp myimage
```

프로덕션에서는 `seccomp=unconfined` 대신 커스텀 프로파일에서 필요한 syscall만 허용하는 것이 안전하다.

## 기본 사용법

```bash
# 컨테이너 내부에서 (strace가 이미지에 있는 경우)
docker exec myapp strace -p 1

# 호스트에서 (nsenter 방식)
PID=$(docker inspect --format '{{.State.Pid}}' myapp)
sudo strace -p "$PID"

# 새 프로세스 추적 (시작부터)
docker exec myapp strace /app/server --config /etc/app/config.yaml
```

## 시나리오별 syscall 필터

![디버깅 시나리오별 syscall 필터](/assets/posts/docker-strace-attach-syscalls.svg)

### 파일 접근 문제

어떤 설정 파일을 찾지 못하는지 확인할 때 유용하다.

```bash
# 파일 시스템 관련 syscall만 추적
sudo strace -p "$PID" -e trace=openat,open,read,write,close -s 256 2>&1 | \
  grep -v ENOENT | head -30

# 실패한 open만 보기
sudo strace -p "$PID" -e trace=openat 2>&1 | grep "= -1 ENOENT"
# openat(AT_FDCWD, "/etc/app/secret.key", O_RDONLY) = -1 ENOENT (No such file or directory)
```

### 네트워크 연결 문제

어떤 IP/포트로 연결을 시도하는지 추적한다.

```bash
# 네트워크 syscall 추적
sudo strace -p "$PID" -e trace=network 2>&1 | grep -v EAGAIN

# connect 실패만 보기
sudo strace -p "$PID" -e trace=connect 2>&1 | grep "= -1"
# connect(3, {sa_family=AF_INET, sin_addr=10.0.0.5, sin_port=5432}, ...) = -1 ECONNREFUSED
```

이 출력으로 앱이 DB에 접근할 때 어떤 IP를 사용하는지 직접 확인할 수 있다. DNS 설정 오류나 잘못된 환경변수를 찾는 데 효과적이다.

### 성능 분석

```bash
# syscall 통계 (-c)
sudo strace -p "$PID" -c &
STRACE_PID=$!
sleep 30
kill -SIGINT $STRACE_PID

# 예시 출력:
# % time  seconds  calls  errors  syscall
# 68.12   0.043234   1024       0  epoll_wait
# 15.23   0.009671    512      12  futex
#  8.45   0.005362    256       0  read
```

### 자식 프로세스 포함 추적

```bash
# -f: fork/exec된 자식 프로세스도 추적
sudo strace -p "$PID" -f -e trace=execve 2>&1

# 프로세스별로 출력 분리
sudo strace -p "$PID" -f -e trace=execve -o /tmp/strace.txt
grep "execve" /tmp/strace.txt
```

## eBPF 기반 도구: perf와 bpftrace

strace는 `ptrace` 기반이라 성능 오버헤드가 크다(최대 100배 느려짐). 프로덕션에서는 eBPF 기반 도구가 더 적합하다.

```bash
# bpftrace: 특정 syscall 이벤트 추적 (오버헤드 매우 낮음)
bpftrace -e 'tracepoint:syscalls:sys_enter_openat /comm == "myapp"/ { printf("%s\n", str(args->filename)); }'

# perf: 컨테이너 내 프로세스 성능 프로파일링
sudo perf stat -p "$PID" sleep 10
sudo perf record -p "$PID" sleep 10
sudo perf report

# pidstat: CPU/메모리를 프로세스별로 추적
pidstat -p "$PID" 1 10
```

## 실전 사례: 설정 파일 경로 오류

```bash
# 앱이 시작하자마자 종료됨 - strace로 원인 찾기
docker run --rm --cap-add SYS_PTRACE \
  --entrypoint strace myapp:latest \
  -e trace=openat -s 200 /app/server 2>&1 | head -20

# 출력:
# openat(AT_FDCWD, "/etc/myapp/config.yml", O_RDONLY) = -1 ENOENT
# openat(AT_FDCWD, "/app/config.yml", O_RDONLY) = -1 ENOENT
# 
# → 앱이 /etc/myapp/config.yml을 찾고 있었으나 /app/config/config.yml로 마운트됨
```

```bash
# 수정: 올바른 경로로 마운트
docker run -v $(pwd)/config.yml:/etc/myapp/config.yml myapp:latest
```

## seccomp 프로파일 생성에 strace 활용

strace 출력으로 앱이 실제로 사용하는 syscall 목록을 만들어 최소 권한 seccomp 프로파일을 만들 수 있다.

```bash
# 앱이 사용하는 syscall 목록 추출
sudo strace -p "$PID" -c 2>&1 | \
  awk 'NR>3 && $5 != "syscall" {print $5}' | sort -u

# oci-seccomp-bpf-hook으로 자동 생성
docker run --annotation io.containers.trace-syscall=of:/tmp/seccomp.json \
  myapp:latest
```

---

**지난 글:** [컨테이너에 셸로 접속하기: exec, attach, nsenter](/posts/docker-shell-into/)

**다음 글:** [tcpdump로 컨테이너 네트워크 패킷 분석하기](/posts/docker-tcpdump-in-container/)

<br>
읽어주셔서 감사합니다. 😊
