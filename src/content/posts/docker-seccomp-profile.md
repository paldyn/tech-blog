---
title: "Docker seccomp 프로파일: 허용 syscall 화이트리스트"
description: "seccomp(Secure Computing Mode)로 컨테이너가 호출할 수 있는 Linux syscall을 제한하는 방법, 기본 프로파일 구조, 커스텀 화이트리스트 JSON 작성, 필요한 syscall 자동 탐지 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "seccomp", "syscall", "BPF", "보안", "리눅스커널"]
featured: false
draft: false
---

[지난 글](/posts/docker-cap-drop-add/)에서 Linux Capability를 최소화하는 방법을 살펴봤다. Capability가 "어떤 종류의 권한을 가지는가"를 제어한다면, **seccomp**는 "어떤 시스템 호출(syscall)을 사용할 수 있는가"를 제어한다. 두 메커니즘은 상호 보완적이다.

## seccomp란

seccomp(Secure Computing Mode)는 Linux 커널 기능으로, 프로세스가 호출할 수 있는 syscall을 BPF(Berkeley Packet Filter) 프로그램으로 필터링한다. 허용되지 않은 syscall을 호출하면 EPERM을 반환하거나 프로세스를 강제 종료한다.

```bash
# 현재 컨테이너의 seccomp 상태 확인
docker inspect mycontainer | \
  python3 -c "import sys,json; c=json.load(sys.stdin)[0]; \
  print(c['HostConfig']['SecurityOpt'])"
# → ['seccomp={"defaultAction":"SCMP_ACT_ERRNO",...}']
# 또는 null이면 기본 프로파일 적용 중
```

## Docker 기본 seccomp 프로파일

Docker는 기본적으로 약 300개의 syscall을 허용하고 나머지를 차단한다. 차단된 syscall에는 커널 모듈 로드(`init_module`), 시스템 재부팅(`reboot`), 컨테이너 탈출에 쓰이는 `kexec_load`, `perf_event_open` 등이 포함된다.

```bash
# 기본 프로파일 확인 (moby GitHub에서)
# https://github.com/moby/moby/blob/master/profiles/seccomp/default.json

# 특정 syscall이 기본 프로파일에서 허용되는지 확인 (default.json에서 검색)
curl -s https://raw.githubusercontent.com/moby/moby/master/profiles/seccomp/default.json \
  | grep '"reboot"'
```

## 기본 프로파일 비활성화

특정 상황에서는 기본 프로파일이 앱을 방해한다.

```bash
# seccomp 완전 비활성화 (보안 감소 — 필요한 경우만)
docker run --security-opt seccomp=unconfined myapp

# 특정 syscall만 차단하는 커스텀 프로파일 적용
docker run --security-opt seccomp=/path/to/profile.json myapp
```

## 커스텀 seccomp 프로파일 작성

![seccomp 필터링 아키텍처](/assets/posts/docker-seccomp-profile-arch.svg)

프로파일은 JSON 파일로 작성한다.

### 화이트리스트 방식 (권장)

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "syscalls": [
    {
      "names": [
        "read", "write", "open", "openat",
        "close", "stat", "fstat", "lstat",
        "mmap", "mprotect", "munmap",
        "brk", "rt_sigaction", "rt_sigprocmask",
        "ioctl", "pread64", "pwrite64",
        "access", "pipe", "select",
        "sched_yield", "mremap", "msync",
        "socket", "connect", "accept", "sendto",
        "recvfrom", "bind", "listen",
        "getsockname", "getpeername",
        "clone", "fork", "execve", "wait4",
        "kill", "exit", "exit_group",
        "getcwd", "chdir", "getpid", "getppid",
        "getuid", "geteuid", "getgid", "getegid",
        "futex", "nanosleep", "clock_gettime",
        "arch_prctl", "set_tid_address",
        "set_robust_list", "prlimit64",
        "getrandom", "rseq"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

### 블랙리스트 방식 (위험 syscall만 차단)

```json
{
  "defaultAction": "SCMP_ACT_ALLOW",
  "syscalls": [
    {
      "names": [
        "kexec_load",
        "perf_event_open",
        "personality",
        "init_module",
        "finit_module",
        "delete_module",
        "reboot",
        "clone",
        "unshare"
      ],
      "action": "SCMP_ACT_ERRNO"
    }
  ]
}
```

블랙리스트는 새 syscall이 추가될 때 자동으로 허용되므로 화이트리스트보다 덜 안전하다.

![커스텀 seccomp 프로파일 구조](/assets/posts/docker-seccomp-profile-json.svg)

## 필요한 syscall 자동 탐지

어떤 syscall이 필요한지 수동으로 파악하기 어렵다. 도구를 이용해 자동으로 추적한다.

### strace로 추적

```bash
# 앱이 사용하는 syscall 목록 추출
docker run --rm --security-opt seccomp=unconfined \
  myapp strace -o /tmp/syscalls.txt -e trace=all myapp-binary arg1

# 또는 실행 중인 컨테이너에서
docker exec mycontainer strace -p 1 -o /tmp/syscalls.txt
```

### oci-seccomp-bpf-hook

eBPF를 이용해 컨테이너 실행 중 사용된 syscall을 자동으로 수집해 프로파일을 생성한다.

```bash
# 설치 (Fedora/RHEL)
dnf install oci-seccomp-bpf-hook

# syscall 추적 후 프로파일 자동 생성
podman run \
  --annotation io.containers.trace-syscall=of:/tmp/profile.json \
  myapp:latest

# 생성된 프로파일 확인
cat /tmp/profile.json
```

### docker-slim으로 자동 프로파일 생성

```bash
# docker-slim으로 minimal 프로파일 자동 생성
slim build --target myapp:latest --tag myapp:slim
# → seccomp 프로파일도 자동 생성됨
```

## SCMP_ACT_LOG로 감사 모드

프로덕션 적용 전 먼저 로그 모드로 실행해 차단될 syscall이 없는지 확인한다.

```json
{
  "defaultAction": "SCMP_ACT_LOG",
  "syscalls": [
    {
      "names": ["kexec_load", "reboot", "init_module"],
      "action": "SCMP_ACT_ERRNO"
    }
  ]
}
```

```bash
# 로그 모드로 실행 후 감사 로그 확인
docker run --security-opt seccomp=/path/to/log-profile.json myapp

# 호스트에서 auditd 로그 확인
ausearch -ts recent | grep seccomp
# → type=SECCOMP msg=audit: ... syscall=xxx
```

## Compose 설정

```yaml
services:
  web:
    image: myapp:latest
    security_opt:
      - seccomp:/path/to/seccomp-profile.json
      - no-new-privileges:true
```

## 기본 프로파일 + capability 조합

seccomp와 capability는 서로 다른 레이어에서 작동한다.

```bash
# 권장 조합: 기본 seccomp + cap-drop + no-new-privileges
docker run \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  --security-opt=no-new-privileges \
  --security-opt seccomp=/path/to/profile.json \
  --read-only \
  --user=1000:1000 \
  myapp:latest
```

## 주의사항

- 화이트리스트 방식은 앱이 업데이트되면 새로 필요한 syscall이 추가될 수 있다. CI에서 프로파일 적합성을 테스트한다.
- Go 런타임, JVM 등은 일부 플랫폼에서 추가 syscall이 필요하다. 직접 테스트해야 한다.
- Kubernetes는 seccomp 프로파일을 `RuntimeDefault` 또는 커스텀 프로파일로 지정할 수 있다.

```yaml
# Kubernetes securityContext
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault   # containerd/CRI의 기본 프로파일
      # type: Localhost
      # localhostProfile: profiles/my-profile.json
```

---

**지난 글:** [Docker cap-drop/add: Linux Capability 최소화](/posts/docker-cap-drop-add/)

**다음 글:** [Docker AppArmor/SELinux: 강제 접근 제어 적용](/posts/docker-apparmor-selinux/)

<br>
읽어주셔서 감사합니다. 😊
