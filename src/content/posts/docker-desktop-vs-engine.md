---
title: "Docker Desktop vs Docker Engine — 언제 무엇을 쓸까?"
description: "Docker Desktop과 Docker Engine의 아키텍처 차이, 라이선스 정책, 성능 트레이드오프, 그리고 macOS/Windows 대안 도구(Colima, OrbStack, Rancher Desktop)를 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["Docker", "Docker Desktop", "Docker Engine", "Colima", "OrbStack"]
featured: false
draft: false
---

[지난 글](/posts/docker-install/)에서 각 플랫폼별 Docker 설치 방법을 살펴봤습니다. 설치 단계에서 자연스럽게 나오는 질문이 있습니다. "Docker Desktop을 써야 할까요, 아니면 Docker Engine을 설치해야 할까요?" 이 글에서 두 제품의 차이를 명확하게 정리합니다.

## 핵심 차이: 무엇이 Docker를 실행하는가

**Docker Engine**은 Linux에서 직접 실행되는 서버용 Docker입니다. `dockerd` 데몬이 호스트 Linux 커널의 namespace/cgroup을 직접 사용합니다. 오버헤드가 없고, 오픈소스이며, 무료입니다.

**Docker Desktop**은 macOS, Windows, Linux에서 실행되는 GUI 애플리케이션입니다. macOS와 Windows에는 Linux 커널이 없기 때문에, Docker Desktop은 내부적으로 경량 Linux VM을 생성해 그 안에서 dockerd를 실행합니다.

![Docker Desktop vs Docker Engine 비교](/assets/posts/docker-desktop-vs-engine-compare.svg)

## Docker Desktop의 내부 구조

macOS에서 `docker run nginx`를 실행하면 실제로는 다음 경로를 거칩니다:

```text
docker CLI (macOS)
  → /var/run/docker.sock (소켓 포워딩)
    → Linux VM 내부 dockerd
      → containerd → runc
        → Container (Linux namespace)
```

사용자는 VM의 존재를 의식하지 않아도 되지만, 이 구조가 성능과 파일 공유에 영향을 줍니다.

![Docker Desktop 내부 아키텍처](/assets/posts/docker-desktop-vs-engine-arch.svg)

## 라이선스 정책

2021년 8월, Docker Inc.가 Docker Desktop의 라이선스 정책을 변경했습니다.

- **개인 사용, 소규모 비즈니스(직원 250인 미만, 연매출 $10M 미만), 오픈소스 프로젝트, 교육**: 무료
- **그 외 기업**: 유료 구독 필요 (Pro, Team, Business 플랜)

Docker Engine 자체는 여전히 Apache 2.0 오픈소스이며 무료입니다. 기업 환경에서 Linux 서버에 Docker Engine만 설치하는 것은 라이선스 비용 없이 무료입니다.

## 성능 고려 사항

### bind mount 성능

macOS에서 로컬 디렉터리를 컨테이너에 마운트(`-v $(pwd):/app`)하면, 호스트 macOS 파일시스템과 Linux VM 파일시스템 사이의 동기화가 발생합니다.

Docker Desktop은 VirtioFS(기본값)나 gRPC FUSE를 사용해 파일을 공유합니다. VirtioFS가 훨씬 빠르지만 여전히 Linux Native 대비 레이턴시가 있습니다. 파일 I/O가 많은 개발 환경(예: Node.js `node_modules`, Rails 앱)에서는 차이를 체감할 수 있습니다.

### 메모리/CPU 자원

Docker Desktop은 VM에 메모리와 CPU를 할당합니다. 기본값은 시스템에 따라 다르며, 설정에서 조정할 수 있습니다.

```text
# Docker Desktop → Settings → Resources에서 조정
Memory: 4 GB (기본)
CPUs: 4 (기본)
Swap: 1 GB
```

## macOS 대안 도구

Docker Desktop의 유료 정책이 부담스럽거나, 성능이나 오픈소스를 선호한다면 대안이 있습니다.

### Colima (무료, 오픈소스)

```bash
brew install colima docker docker-compose docker-buildx

# Lima VM 시작
colima start --cpu 4 --memory 8

# Apple Silicon에서 x86 에뮬레이션
colima start --arch x86_64 --vm-type=rosetta

# 상태 확인
colima status
```

Colima는 Lima VM 위에서 containerd 또는 Docker를 실행합니다. 명령줄 중심 워크플로에 적합합니다.

### OrbStack (유료, 빠른 성능)

OrbStack은 macOS 전용 상용 도구로, VirtioFS보다 빠른 자체 파일 공유 구현을 제공합니다. 개인 사용은 무료입니다.

```bash
brew install --cask orbstack
```

### Rancher Desktop (Windows/macOS, 무료)

containerd 또는 dockerd 백엔드를 선택할 수 있으며, 내장 Kubernetes(k3s) 지원합니다.

## Docker Desktop의 유용한 기능들

유료 라이선스 가치가 있는 기능들:

```bash
# 내장 Kubernetes 활성화 (Settings → Kubernetes)
kubectl get nodes
# NAME             STATUS   ROLES           AGE   VERSION
# docker-desktop   Ready    control-plane   ...

# Dev Environments (컨테이너 기반 개발 환경)
docker dev create https://github.com/myuser/myproject

# Docker Extensions (플러그인 마켓플레이스)
docker extension install portainer/portainer-docker-extension
```

## 선택 가이드 요약

| 상황 | 권장 |
|------|------|
| Linux 서버/CI/프로덕션 | Docker Engine |
| macOS 개발 (기업, 라이선스 보유) | Docker Desktop |
| macOS 개발 (개인/소규모/오픈소스) | Docker Desktop (무료) 또는 Colima |
| macOS 개발 (성능 우선) | OrbStack |
| Windows 개발 | Docker Desktop (WSL 2) |
| Kubernetes 로컬 개발 | Docker Desktop 또는 Rancher Desktop |

## 정리

Docker Desktop은 macOS/Windows 개발자를 위한 올인원 도구로 GUI, 내장 Kubernetes, 파일 동기화를 제공하지만 기업 환경에서는 유료입니다. Docker Engine은 Linux 전용의 무료 서버 런타임입니다. macOS에서는 Colima, OrbStack 같은 오픈소스/상용 대안도 좋은 선택입니다. 다음 글에서는 보안을 고려할 때 중요한 Rootless 모드를 다룹니다.

---

**지난 글:** [Docker 설치 완전 가이드](/posts/docker-install/)

**다음 글:** [Docker Rootless 모드 — root 없이 안전하게 실행하기](/posts/docker-rootless-mode/)

<br>
읽어주셔서 감사합니다. 😊
