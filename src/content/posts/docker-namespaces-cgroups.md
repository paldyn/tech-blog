---
title: "Linux Namespaces & cgroups — Docker 격리의 진짜 원리"
description: "Docker 컨테이너가 어떻게 프로세스·네트워크·파일시스템·자원을 격리하는지, Linux Namespaces 8종과 cgroup v2 컨트롤러 구조를 실습과 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "namespace", "cgroup", "linux-kernel", "container-internals", "isolation", "resource-limit"]
featured: false
draft: false
---

[지난 글](/posts/docker-buildkit-deepdive/)에서 BuildKit의 고급 빌드 기능을 살펴봤다. 이번에는 한 발짝 더 아래로 내려가 Docker 컨테이너가 어떻게 격리되고 자원이 제한되는지, **Linux Namespaces**와 **cgroups**라는 두 핵심 커널 기능을 통해 이해한다.

## 왜 알아야 하는가

`docker run` 한 줄이면 컨테이너가 뜨지만, 그 안에서는 커널 수준의 복잡한 격리 메커니즘이 동작한다. 이를 이해하면 컨테이너 보안 설계, 자원 경합 디버깅, rootless 컨테이너 동작 원리까지 명확하게 파악할 수 있다.

## Linux Namespaces

Namespace는 커널 자원의 **글로벌 뷰를 프로세스별로 분리**하는 메커니즘이다. 현재 Linux 커널은 8종의 Namespace를 지원하며 Docker는 이 중 6종을 기본으로 사용한다.

![Linux Namespaces 다이어그램](/assets/posts/docker-namespaces-cgroups-namespaces.svg)

| Namespace | 격리 대상 | Docker 기본 사용 |
|---|---|---|
| **PID** | 프로세스 ID 트리 | ✅ |
| **NET** | 네트워크 스택 (인터페이스·라우팅·포트) | ✅ |
| **MNT** | 마운트 포인트·파일시스템 트리 | ✅ |
| **UTS** | hostname, domainname | ✅ |
| **IPC** | 공유메모리·세마포어·메시지 큐 | ✅ |
| **USER** | UID/GID 매핑 | rootless에서만 |
| **CGROUP** | cgroup 계층 뷰 | ✅ (Linux 4.6+) |
| **TIME** | 시스템 시계 | ❌ |

```bash
# 현재 프로세스의 Namespace 목록 확인
ls -la /proc/$$/ns/

# 컨테이너 PID를 호스트에서 확인
docker inspect --format '{{.State.Pid}}' mycontainer
ls -la /proc/<호스트PID>/ns/

# 새 Namespace 생성 후 진입 (개발자 실험용)
unshare --pid --fork --mount-proc bash
echo $$   # → 1 (새 PID ns 안에서의 PID)
```

### PID Namespace

컨테이너 내부에서 `ps aux`를 실행하면 PID 1이 보인다. 이 PID 1은 **Namespace 내부에서만 유효**하다. 호스트 커널은 동일 프로세스를 다른 PID(예: 3412)로 인식한다. `kill -9` 같은 시그널은 항상 호스트 PID를 기준으로 동작하므로 이 차이를 혼동하지 않아야 한다.

### NET Namespace

컨테이너마다 독립적인 네트워크 스택이 생긴다. Docker는 `veth pair`(가상 이더넷 쌍)를 만들어 한 쪽은 컨테이너의 `eth0`, 다른 쪽은 호스트의 `docker0` 브리지에 연결한다.

```bash
# 컨테이너 내부 네트워크 인터페이스
docker exec mycontainer ip link show

# 호스트에서 veth 확인
ip link show | grep veth

# 컨테이너의 NET Namespace로 진입
nsenter --target <호스트PID> --net ip addr
```

### MNT Namespace와 pivot_root

컨테이너 파일시스템 격리의 핵심은 `pivot_root(2)` 시스템 콜이다. 이를 통해 컨테이너가 보는 루트(`/`)를 이미지 레이어로 교체한다. 이전 방식인 `chroot`와 달리 `pivot_root`는 진짜 루트를 완전히 교체하므로 탈출이 불가능하다(적절한 권한 설정 시).

## cgroups — 자원 제한 엔진

Namespace가 격리를 담당한다면, **cgroups**(Control Groups)는 CPU·메모리·디스크 I/O 등 자원을 **계층적으로 제한**한다.

![cgroups 계층 구조](/assets/posts/docker-namespaces-cgroups-cgroups.svg)

```bash
# cgroup v2 확인 (systemd + Linux 5.x 이상 기본)
mount | grep cgroup2
# cgroup2 on /sys/fs/cgroup type cgroup2 ...

# Docker가 생성한 cgroup 확인
ls /sys/fs/cgroup/system.slice/docker-<CID>.scope/

# 컨테이너 메모리 한도 직접 읽기
cat /sys/fs/cgroup/system.slice/docker-<CID>.scope/memory.max

# CPU 제한 상태 (50% = 50000/100000)
cat /sys/fs/cgroup/system.slice/docker-<CID>.scope/cpu.max
```

### docker run 플래그와 cgroup 매핑

```bash
# CPU 50% 제한 → cpu.max: 50000 100000
docker run --cpus="0.5" nginx

# 메모리 512MB 제한 → memory.max: 536870912
docker run --memory="512m" nginx

# CPU 핀 (특정 코어만) → cpuset.cpus: 0,2
docker run --cpuset-cpus="0,2" nginx

# PID 개수 제한 → pids.max: 100
docker run --pids-limit=100 nginx

# 현재 컨테이너의 자원 사용량 실시간 확인
docker stats --no-stream mycontainer
```

### cgroup v1 vs v2

| 항목 | v1 | v2 |
|---|---|---|
| 계층 구조 | 컨트롤러별 다중 계층 | 단일 통합 계층 |
| 기본 채택 | RHEL 7, Ubuntu 18.04 이하 | Ubuntu 20.04+, RHEL 9+ |
| 자원 분배 | 독립적 | 통합 weight 기반 |
| Docker 지원 | ✅ | ✅ (Docker 20.10+) |

## Namespace + cgroup 합산 — 컨테이너의 정체

컨테이너는 사실 **특수한 프로세스 그룹**이다. VM처럼 별도 OS 커널이 없다. Docker는 `clone(2)` 시스템 콜로 새 Namespace를 생성하고, cgroup으로 자원을 묶고, OverlayFS로 파일시스템 뷰를 제공한다. 이 세 가지가 합쳐져서 사용자 눈에는 격리된 환경처럼 보이는 것이다.

```bash
# 컨테이너 프로세스의 cgroup과 namespace 동시 확인
PID=$(docker inspect --format '{{.State.Pid}}' mycontainer)
cat /proc/$PID/cgroup
ls /proc/$PID/ns/

# 스스로 격리 실험 (비교용)
unshare --pid --net --mount --fork --mount-proc \
  bash -c "echo 'PID: $$; hostname: $(hostname)'"
```

## 보안 함의

Namespace는 격리를 제공하지만 완벽하지 않다. 기본 Docker 컨테이너는 **USER Namespace를 사용하지 않으므로** 컨테이너 내부의 root(UID 0)가 호스트 커널에도 root로 인식된다. 이를 해결하려면 rootless 모드나 USER Namespace 매핑, 또는 `--cap-drop=ALL` 조합을 써야 한다.

```bash
# 컨테이너 내부 UID 확인
docker exec mycontainer id
# uid=0(root) gid=0(root)

# 호스트에서 해당 PID의 UID 확인 (USER ns 없으면 0)
cat /proc/<호스트PID>/status | grep ^Uid
```

---

**지난 글:** [Docker BuildKit 심화 — 내부 구조와 고급 기능](/posts/docker-buildkit-deepdive/)

**다음 글:** [OverlayFS — 컨테이너 파일시스템의 비밀](/posts/docker-overlayfs/)

<br>
읽어주셔서 감사합니다. 😊
