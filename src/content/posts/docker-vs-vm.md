---
title: "컨테이너 vs 가상 머신 — 무엇을 선택할까?"
description: "VM과 컨테이너의 아키텍처 차이, 격리 방식, 성능·보안 트레이드오프를 비교하고, 실제 운영 환경에서 언제 무엇을 선택하면 좋은지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["Docker", "VM", "가상머신", "컨테이너", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/docker-what-is-container/)에서 컨테이너가 namespace와 cgroup 위에서 동작하는 격리된 프로세스 환경임을 살펴봤습니다. 컨테이너를 처음 배울 때 가장 많이 받는 질문이 "VM이랑 뭐가 다른데요?"입니다. 이 글에서는 두 기술의 아키텍처를 나란히 놓고 비교하고, 실제 선택 기준을 정리합니다.

## 아키텍처 비교

가장 근본적인 차이는 **OS 커널을 공유하느냐 아니냐**입니다.

### 가상 머신 스택

```text
[ App ] [ App ] [ App ]
[ Guest OS ] [ Guest OS ] [ Guest OS ]
[ Hypervisor (VMware, KVM, Hyper-V) ]
[ Host OS ]
[ Hardware ]
```

하이퍼바이저는 물리 하드웨어를 추상화해 여러 게스트 OS에게 가상의 CPU, 메모리, 디스크를 제공합니다. 각 VM은 완전히 독립적인 커널과 OS를 가지기 때문에, Windows 위에서 Linux VM을 띄우거나 ARM 서버에서 x86 에뮬레이션을 돌리는 것도 가능합니다.

### 컨테이너 스택

```text
[ App ] [ App ] [ App ]
[ Libs ] [ Libs ] [ Libs ]
[ Container Runtime (Docker / containerd) ]
[ Host OS Kernel (공유) ]
[ Hardware ]
```

컨테이너는 커널을 공유합니다. 하이퍼바이저 레이어가 없기 때문에 커널 시스템 콜은 그대로 호스트 커널로 전달됩니다. 격리는 namespace가 담당하고 자원 제한은 cgroup이 담당합니다.

![VM vs 컨테이너 아키텍처](/assets/posts/docker-vs-vm-architecture.svg)

## 주요 특성 비교

![VM vs 컨테이너 비교표](/assets/posts/docker-vs-vm-comparison.svg)

### 이미지 크기와 시작 속도

VM 이미지는 OS 전체를 담기 때문에 수백 MB에서 수 GB입니다. 부팅 시 BIOS 초기화, 커널 로드, 서비스 시작 과정을 거쳐 수십 초에서 수 분이 걸립니다.

컨테이너 이미지는 애플리케이션과 의존성만 담습니다. Alpine 기반 Go 앱이라면 10 MB 미만도 가능합니다. 시작 시 새 namespace를 생성하고 프로세스를 띄우는 것이 전부라 수백 밀리초면 충분합니다.

### 격리 수준

VM은 하드웨어 수준의 격리를 제공합니다. 게스트 커널에 취약점이 있어도 하이퍼바이저 경계를 넘기가 매우 어렵습니다. 이 때문에 멀티테넌시 환경(클라우드 공용 인프라)에서는 VM 격리가 기본 단위로 쓰입니다.

컨테이너는 namespace 수준의 소프트웨어 격리입니다. 커널 취약점을 이용하면 컨테이너 탈출(escape)이 가능합니다. 따라서 신뢰할 수 없는 코드를 실행하는 환경에서는 gVisor, Kata Containers 같은 강화된 런타임을 함께 사용합니다.

### 성능 오버헤드

VM은 하이퍼바이저가 CPU 명령어와 I/O를 중계하는 오버헤드가 있습니다. 현대 하드웨어 가상화 지원(Intel VT-x, AMD-V) 덕분에 많이 줄었지만 네이티브 대비 차이가 존재합니다.

컨테이너는 커널 시스템 콜을 직접 실행하므로 성능 오버헤드가 거의 없습니다. 벤치마크에서 네이티브 프로세스와 성능 차이가 1~3% 수준에 불과합니다.

## VM과 컨테이너는 경쟁 관계가 아니다

현실 인프라에서 두 기술은 **계층적으로** 사용됩니다.

```text
Cloud VM (EC2, GCE, Azure VM)
  └── Container Runtime (Docker / containerd)
        ├── Container 1 (nginx)
        ├── Container 2 (app)
        └── Container 3 (sidecar)
```

AWS EC2 인스턴스(VM) 위에 Docker를 설치하고 여러 컨테이너를 실행하는 패턴이 가장 일반적입니다. VM은 테넌트 간 강한 보안 경계를 제공하고, 컨테이너는 그 안에서 빠른 배포와 자원 효율을 담당합니다.

## 선택 기준

| 상황 | 추천 |
|------|------|
| 다른 OS 커널이 필요 (Linux ↔ Windows) | VM |
| 멀티테넌트, 신뢰할 수 없는 코드 실행 | VM 또는 강화된 컨테이너 런타임 |
| 마이크로서비스, 빠른 스케일 아웃 | 컨테이너 |
| 로컬 개발 환경 재현 | 컨테이너 |
| CI/CD 파이프라인 | 컨테이너 |
| 레거시 모놀리식 앱 리프트앤시프트 | VM 또는 컨테이너 (상황에 따라) |

## 정리

VM은 하이퍼바이저로 하드웨어를 추상화해 강한 격리를 제공하고, 컨테이너는 커널을 공유하면서 namespace/cgroup으로 가볍고 빠른 격리를 제공합니다. 현대 클라우드 환경에서는 대부분 VM 안에서 컨테이너를 실행하는 조합을 사용합니다. 다음 글에서는 컨테이너 기술이 어떻게 탄생하고 Docker가 어떻게 이 시장을 정의했는지 역사를 살펴봅니다.

---

**지난 글:** [컨테이너란 무엇인가?](/posts/docker-what-is-container/)

**다음 글:** [Docker의 역사 — chroot에서 OCI 표준까지](/posts/docker-history/)

<br>
읽어주셔서 감사합니다. 😊
