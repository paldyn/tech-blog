---
title: "Container Namespaces 상세 — 컨테이너 격리의 실제 구현"
description: "Linux 7가지 Namespace(PID·Network·Mount·UTS·IPC·User·Cgroup) 동작 원리, unshare·nsenter 실습, Docker 네트워킹에서 veth pair와 iptables NAT 동작, User Namespace 기반 rootless 컨테이너를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "namespace", "container", "docker", "network", "pid", "user-namespace", "unshare"]
featured: false
draft: false
---

[지난 글](/posts/linux-oom-killer/)에서 OOM Killer가 메모리 부족 시 프로세스를 선택하는 방법을 배웠습니다. 이번에는 Docker·Kubernetes 같은 컨테이너 기술의 핵심 기반인 **Linux Namespace**를 깊이 살펴봅니다. Namespace는 각 프로세스가 "자신만의 시스템"을 가진 것처럼 보이게 하는 커널 기능입니다.

## Namespace란

Namespace는 커널 자원(프로세스 목록, 네트워크, 파일시스템 등)을 **분리된 뷰(view)**로 제공합니다. 같은 커널에서 실행되지만 각 프로세스 그룹은 서로를 볼 수 없고, 독립된 환경에 있는 것처럼 동작합니다.

현재 리눅스는 7종의 Namespace를 지원합니다.

![Namespace 7종 상세](/assets/posts/linux-container-namespaces-detail-arch.svg)

## 1. PID Namespace

```bash
# 새 PID 네임스페이스에서 bash 실행
sudo unshare --pid --fork bash

# 이 bash는 자신을 PID 1로 봄
echo $$  # 출력: 1

# 호스트에서는 실제 PID가 큰 숫자
```

컨테이너 내부에서 `ps aux`를 하면 컨테이너 프로세스만 보입니다. 하지만 호스트에서 보면 실제 PID는 큰 숫자입니다. 부모 PID 네임스페이스는 자식 네임스페이스의 프로세스를 볼 수 있지만, 역방향은 불가능합니다.

## 2. Network Namespace

![Network Namespace 구조](/assets/posts/linux-container-namespaces-detail-net.svg)

```bash
# 새 네트워크 네임스페이스 생성
sudo ip netns add myns

# 해당 ns에서 명령 실행
sudo ip netns exec myns ip addr
# lo만 보임 (loopback만 있는 독립된 네트워크 스택)

# veth 페어 생성 (두 ns를 연결)
sudo ip link add veth0 type veth peer name veth1
sudo ip link set veth1 netns myns

# ns 목록
sudo ip netns list
```

Docker는 컨테이너마다 독립된 Network Namespace를 만들고, `veth pair`로 호스트의 `docker0` 브릿지에 연결합니다. 컨테이너-호스트 포트 매핑은 iptables DNAT 규칙으로 구현됩니다.

## 3. Mount Namespace

```bash
# 새 Mount 네임스페이스
sudo unshare --mount bash

# 이 bash 내에서만 보이는 마운트 생성
mount --bind /tmp/mydir /mnt/test

# 호스트에서는 /mnt/test가 마운트되지 않음
# (다른 네임스페이스에서 격리됨)
```

Docker는 Mount Namespace + `pivot_root`로 컨테이너의 `/`를 이미지 레이어 위에 올립니다. 호스트의 실제 파일시스템은 컨테이너에서 보이지 않습니다.

## 4. UTS Namespace

```bash
# 새 UTS 네임스페이스 (hostname 격리)
sudo unshare --uts bash

# 이 bash 내에서만 hostname 변경
hostname mycontainer
hostname  # 출력: mycontainer

# 다른 터미널에서 확인하면 원래 hostname 그대로
```

컨테이너가 자신만의 hostname을 갖는 이유입니다. `docker run --hostname=myapp ...`이 UTS Namespace를 활용합니다.

## 5. User Namespace — rootless 컨테이너

User Namespace는 UID/GID를 매핑합니다. 컨테이너 내의 root(UID 0)를 호스트의 일반 사용자(UID 1000)로 매핑할 수 있습니다.

```bash
# 현재 사용자 확인
id  # uid=1000(alice)

# User Namespace에서 bash 실행 (sudo 불필요!)
unshare --user bash

# 이 bash 내에서는 root처럼 동작
id  # uid=0(root) gid=0(root)

# 하지만 호스트에서는 여전히 alice (UID 1000)
# 실제 커널 권한이 없음
```

Podman의 rootless 컨테이너가 User Namespace를 핵심으로 사용합니다.

```bash
# UID 매핑 확인
cat /proc/$$/uid_map
# 0 1000 1 (컨테이너 UID 0 = 호스트 UID 1000, 1개 매핑)
```

## 6. IPC Namespace

공유 메모리(shm), 세마포어, 메시지 큐를 격리합니다.

```bash
# 공유 메모리 목록
ipcs -m

# 새 IPC ns에서 생성한 공유 메모리는 다른 ns에서 안 보임
sudo unshare --ipc bash
ipcmk -M 1024  # 공유 메모리 생성
# 호스트에서 ipcs -m 해도 안 보임
```

## 7. Cgroup Namespace

`/proc/self/cgroup`의 내용을 격리합니다. 컨테이너 내에서 `/sys/fs/cgroup/`이 컨테이너의 cgroup 루트처럼 보여 호스트의 cgroup 계층 구조가 노출되지 않습니다.

## nsenter — 실행 중인 컨테이너 진입

```bash
# 컨테이너 PID 찾기
CONTAINER_PID=$(docker inspect --format='{{.State.Pid}}' mycontainer)

# 컨테이너의 모든 네임스페이스에 진입
sudo nsenter -t $CONTAINER_PID --pid --net --mount --uts --ipc bash

# 특정 네임스페이스만 (네트워크만)
sudo nsenter --net=/proc/$CONTAINER_PID/ns/net ip addr

# 네임스페이스 inode 확인 (같은 ns면 같은 번호)
ls -lai /proc/1/ns/
ls -lai /proc/$CONTAINER_PID/ns/
```

## /proc/PID/ns 디렉터리

각 프로세스의 네임스페이스는 `/proc/PID/ns/` 아래의 심볼릭 링크로 표현됩니다.

```bash
ls -la /proc/$$/ns/
# cgroup -> cgroup:[4026531835]
# ipc    -> ipc:[4026531839]
# mnt    -> mnt:[4026531840]
# net    -> net:[4026531992]
# pid    -> pid:[4026531836]
# user   -> user:[4026531837]
# uts    -> uts:[4026531838]
```

대괄호 안의 숫자(inode)가 같으면 같은 네임스페이스를 공유합니다. 컨테이너와 호스트의 `net` inode를 비교하면 네트워크 격리 여부를 확인할 수 있습니다.

---

**지난 글:** [OOM Killer — 메모리 부족 시 리눅스가 프로세스를 선택하는 방법](/posts/linux-oom-killer/)

**다음 글:** [cgroups v1 vs v2 — 리소스 제한의 두 세대 비교](/posts/linux-cgroups-v1-vs-v2/)

<br>
읽어주셔서 감사합니다. 😊
