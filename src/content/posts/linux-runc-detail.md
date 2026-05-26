---
title: "runc 상세 — OCI Runtime Spec과 컨테이너 생성 원리"
description: "runc의 OCI Runtime Spec 구현 방식, config.json 구조, namespace/cgroup/seccomp 적용 순서, 컨테이너 라이프사이클 상태 전이를 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "runc", "container", "oci", "runtime", "namespace", "cgroup", "seccomp"]
featured: false
draft: false
---

[지난 글](/posts/linux-overlayfs-detail/)에서 OverlayFS가 컨테이너 이미지 레이어를 어떻게 쌓는지 살펴봤습니다. 이번에는 그 레이어를 실제로 실행 가능한 격리 프로세스로 만드는 저수준 런타임 **runc**의 내부 동작을 들여다봅니다.

## runc란

runc는 [opencontainers/runc](https://github.com/opencontainers/runc) 저장소에서 Go로 작성된 CLI 도구로, **OCI Runtime Specification**을 구현한 레퍼런스 구현체입니다. Docker, containerd, Podman 모두 내부적으로 runc(또는 runc 호환 런타임)를 호출해 컨테이너를 실제로 생성합니다.

![runc 아키텍처](/assets/posts/linux-runc-detail-arch.svg)

역할 분리:
- **High-level runtime**(Docker/containerd): 이미지 pull, 볼륨, 네트워크 설정 → OCI Bundle 준비
- **runc**: OCI Bundle을 받아 Linux 커널 기능을 직접 호출해 격리 프로세스 생성

## OCI Bundle 구조

runc가 받는 입력은 **OCI Bundle** — 두 부분으로 구성됩니다.

```
mycontainer/
├── config.json    ← OCI Runtime Spec (격리 설정 전체)
└── rootfs/        ← 컨테이너 루트 파일시스템
    ├── bin/
    ├── usr/
    └── ...
```

`config.json`에는 프로세스 정보(엔트리포인트, 환경변수), namespace 종류, cgroup 제한, seccomp 필터, capability 목록, 마운트 포인트가 모두 들어 있습니다.

```json
{
  "ociVersion": "1.0.2",
  "process": {
    "args": ["/bin/sh"],
    "env": ["PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin"]
  },
  "linux": {
    "namespaces": [
      {"type": "pid"}, {"type": "network"},
      {"type": "ipc"}, {"type": "uts"}, {"type": "mount"}
    ],
    "resources": {
      "memory": {"limit": 134217728}
    }
  }
}
```

## runc 내부 실행 단계

runc create를 실행하면 다음 순서로 격리 환경이 만들어집니다.

1. **config.json 파싱** — 스펙 버전 확인, 필드 유효성 검사
2. **clone(2) 호출** — 지정된 namespace 플래그(`CLONE_NEWPID | CLONE_NEWNET | ...`)로 자식 프로세스 생성
3. **rootfs pivot_root** — 컨테이너 루트 파일시스템으로 루트 전환
4. **마운트 설정** — proc, sys, dev 등 pseudofs 마운트
5. **cgroup 연결** — unified hierarchy 또는 legacy cgroup에 프로세스 배치
6. **seccomp 필터 적용** — `prctl(PR_SET_SECCOMP, ...)` 시스템 콜 필터 설치
7. **capability 드롭** — 불필요한 Linux capability 제거
8. **엔트리포인트 execve** — 최종 프로세스로 exec

```bash
# OCI Bundle 수동 생성
mkdir -p ~/mycontainer/rootfs
docker export $(docker create busybox) | tar -C ~/mycontainer/rootfs -xf -
cd ~/mycontainer
runc spec                  # config.json 생성 (기본 템플릿)

# 컨테이너 생성 (프로세스 아직 미시작)
sudo runc create mycontainer

# 엔트리포인트 시작
sudo runc start mycontainer

# 상태 확인
sudo runc state mycontainer

# 정리
sudo runc kill mycontainer SIGTERM
sudo runc delete mycontainer
```

## 컨테이너 라이프사이클

![runc 라이프사이클](/assets/posts/linux-runc-detail-lifecycle.svg)

`create`와 `start`가 분리되어 있는 이유는 **prestart 훅** 실행 시점을 조정하기 위해서입니다. 네트워크 인터페이스를 연결하거나 볼륨을 마운트하는 외부 작업을 create → (훅 실행) → start 사이에 끼울 수 있습니다.

```bash
# 한 번에 실행 (create + start 통합)
sudo runc run mycontainer

# 실행 중인 컨테이너에 명령 실행
sudo runc exec mycontainer /bin/sh

# 일시 정지 / 재개 (SIGSTOP/SIGCONT 기반)
sudo runc pause mycontainer
sudo runc resume mycontainer
```

## Namespace 격리 원리

runc는 `clone(2)` 시스템 콜에 플래그를 조합해 한 번에 여러 namespace를 만듭니다.

```c
// runc 내부 동작 (의사코드)
clone(child_func, stack,
      CLONE_NEWPID | CLONE_NEWNET |
      CLONE_NEWIPC | CLONE_NEWUTS |
      CLONE_NEWNS  | CLONE_NEWUSER,
      &args);
```

| Namespace | 격리 대상 |
|-----------|-----------|
| pid | 프로세스 ID 트리 |
| net | 네트워크 스택 (인터페이스, 라우팅) |
| ipc | System V IPC, POSIX 메시지 큐 |
| uts | hostname, domainname |
| mnt | 마운트 포인트 뷰 |
| user | UID/GID 매핑 |
| cgroup | cgroup 루트 뷰 |

## rootless runc

Linux 5.x+에서는 user namespace를 활용해 루트 권한 없이 컨테이너를 실행할 수 있습니다.

```bash
# config.json에 user namespace 추가
runc spec --rootless

# 루트 없이 실행
runc run --root /tmp/runc mycontainer
```

rootless 모드의 제약: 일부 파일시스템 마운트 불가, cgroup v1 제한, 일부 네트워크 기능 미지원.

## runc vs 다른 런타임

| 런타임 | 특징 |
|--------|------|
| runc | 표준 OCI, 가장 범용 |
| crun | C 작성, 더 빠른 시작 |
| gVisor(runsc) | 사용자 공간 커널, 보안 강화 |
| kata-containers | VM 기반, 강한 격리 |
| youki | Rust 작성, 실험적 |

containerd나 Podman의 `runtime` 옵션으로 runc를 gVisor나 kata로 교체할 수 있습니다.

---

**지난 글:** [OverlayFS 상세 — 컨테이너 이미지 레이어 스토리지의 원리](/posts/linux-overlayfs-detail/)

**다음 글:** [Podman 루트리스 컨테이너 — Docker 없이 안전하게](/posts/linux-podman-rootless/)

<br>
읽어주셔서 감사합니다. 😊
