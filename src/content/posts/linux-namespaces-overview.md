---
title: "namespaces 완전 개요 — 프로세스 격리의 원리"
description: "리눅스 namespaces 7종(mnt, uts, ipc, net, pid, user, cgroup)의 역할, unshare/nsenter/lsns 사용법, 컨테이너 격리 원리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "namespaces", "container", "isolation", "unshare", "nsenter", "pid-ns", "net-ns", "user-ns"]
featured: false
draft: false
---

[지난 글](/posts/linux-cgroups-overview/)에서 cgroups로 자원을 제한하는 방법을 배웠습니다. 그런데 도커 컨테이너가 호스트와 다른 PID 공간, 다른 파일시스템, 다른 네트워크 인터페이스를 갖는 것은 cgroups만으로는 설명되지 않습니다. 그 나머지 절반이 바로 **Linux Namespaces** 입니다.

## Namespace란?

커널의 전역 자원(파일시스템, PID, 네트워크 등)을 **각 프로세스가 독립된 뷰로 보이게** 분리하는 기능입니다. 같은 물리 커널 위에서 프로세스마다 서로 다른 "세계"를 보게 만드는 추상화 계층입니다.

```bash
# 현재 프로세스의 네임스페이스 확인
ls -la /proc/$$/ns/
```

## 7가지 Namespace

![Linux Namespaces 7가지](/assets/posts/linux-namespaces-overview-types.svg)

### mnt (마운트 네임스페이스)

파일시스템 마운트 트리를 격리합니다. 컨테이너가 `/` 로 자체 파일시스템을 보는 원리입니다.

```bash
# 새 mnt 네임스페이스에서 tmpfs 마운트
unshare --mount bash
mount -t tmpfs tmpfs /tmp
# 호스트의 /tmp는 영향 없음
```

### uts (UTS 네임스페이스)

`hostname`과 `domainname`을 격리합니다.

```bash
unshare --uts bash
hostname my-container
hostname  # my-container
# 다른 터미널에서: hostname  # 여전히 원래 이름
```

### ipc (IPC 네임스페이스)

System V IPC(세마포어, 공유 메모리, 메시지 큐)와 POSIX 메시지 큐를 격리합니다.

### net (네트워크 네임스페이스)

네트워크 인터페이스, 라우팅 테이블, iptables 규칙, 소켓을 격리합니다. 컨테이너가 독립 IP를 갖는 이유입니다.

```bash
# 네트워크 ns 생성·진입
ip netns add myns
ip netns exec myns bash

# 새 ns 안에서
ip a  # lo만 존재
```

### pid (PID 네임스페이스)

PID 번호 공간을 격리합니다. 컨테이너 안에서 PID 1이 init/쉘처럼 동작하며, 호스트와 겹치지 않습니다.

```bash
# 새 PID ns에서 bash 실행
unshare --pid --fork --mount-proc bash
ps aux  # bash가 PID 1!
```

### user (사용자 네임스페이스)

UID/GID를 독립적으로 매핑합니다. 네임스페이스 안에서 root(UID 0)이더라도 호스트에서는 일반 사용자로 매핑됩니다. Podman의 rootless 컨테이너 핵심 원리입니다.

```bash
# 일반 사용자가 자신을 root로 매핑
unshare --user --map-root-user bash
id  # uid=0(root) — 이 ns 안에서만
cat /proc/self/uid_map  # 0 1000 1
```

### cgroup (cgroup 네임스페이스)

cgroup 계층 트리의 뷰를 격리합니다. 컨테이너 안에서 `/sys/fs/cgroup/`이 마치 루트처럼 보입니다.

## unshare, nsenter, lsns

![namespace 생성 및 조작](/assets/posts/linux-namespaces-overview-commands.svg)

### 클론 플래그

`clone()` 시스템 콜에 플래그를 조합해 새 네임스페이스를 만들 수 있습니다.

```c
/* 새 PID+UTS+MNT ns로 자식 생성 */
clone(child_func, stack + STACK_SIZE,
      CLONE_NEWPID | CLONE_NEWUTS | CLONE_NEWNS | SIGCHLD,
      NULL);
```

### docker exec의 원리

```bash
# 컨테이너의 PID 찾기
CPID=$(docker inspect --format '{{.State.Pid}}' mycontainer)

# 해당 컨테이너 ns로 직접 진입
nsenter -t $CPID --mount --uts --ipc --net --pid bash
```

## Namespace 격리 요약

| 자원 | Namespace | 격리 대상 |
|------|-----------|----------|
| 파일시스템 | mnt | 마운트 트리 |
| 호스트명 | uts | hostname, domainname |
| IPC | ipc | SHM, 세마포어, MQ |
| 네트워크 | net | 인터페이스, 포트, 라우팅 |
| 프로세스 ID | pid | PID 번호 공간 |
| UID/GID | user | 사용자 매핑 |
| cgroup 뷰 | cgroup | cgroup 계층 |

## 컨테이너 = cgroups + namespaces + OverlayFS

```bash
# 도커가 내부적으로 사용하는 ns 확인
ls -la /proc/$(docker inspect --format '{{.State.Pid}}' myc)/ns/

# 호스트와 컨테이너의 net ns가 다름
readlink /proc/$$/ns/net
readlink /proc/$(docker inspect --format '{{.State.Pid}}' myc)/ns/net
```

## 정리

Linux Namespaces는 7가지 자원을 커널 수준에서 격리해 프로세스마다 독립된 환경을 제공합니다. cgroups가 **얼마나** 사용할지 제어한다면, namespaces는 **무엇이 보이는지** 를 제어합니다. 이 둘을 합치면 컨테이너의 핵심 원리가 완성됩니다. 다음 글부터는 패키지 관리자로 시선을 옮겨, 데비안 계열의 `apt`를 다룹니다.

---

**지난 글:** [cgroups 완전 개요](/posts/linux-cgroups-overview/)

**다음 글:** [apt 기초 — 패키지 설치·제거·업데이트](/posts/linux-apt-basics/)

<br>
읽어주셔서 감사합니다. 😊
