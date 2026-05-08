---
title: "Docker의 역사 — chroot에서 OCI 표준까지"
description: "1979년 chroot부터 2024년 현재까지 컨테이너 기술이 어떻게 발전했는지, Docker가 어떻게 이 생태계를 만들었고 OCI 표준화로 어떻게 진화했는지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["Docker", "컨테이너 역사", "OCI", "LXC", "containerd"]
featured: false
draft: false
---

[지난 글](/posts/docker-vs-vm/)에서 VM과 컨테이너의 아키텍처 차이를 비교했습니다. 그렇다면 이 기술은 어디서 왔을까요? 컨테이너는 Docker가 발명한 것이 아닙니다. Docker는 수십 년에 걸쳐 쌓인 Linux 기술들을 개발자가 쉽게 쓸 수 있는 형태로 묶어 낸 도구입니다. 이 글에서는 그 역사를 따라가 봅니다.

## 1979 — chroot: 격리의 씨앗

컨테이너 격리의 개념적 기원은 1979년 UNIX V7에서 `chroot` 시스템 콜이 도입된 때로 거슬러 올라갑니다. `chroot`는 프로세스의 루트 디렉터리(`/`)를 특정 경로로 변경해 그 바깥의 파일시스템을 볼 수 없게 합니다.

```bash
# chroot 예시: /var/chroot/myenv를 루트로 하는 환경 실행
chroot /var/chroot/myenv /bin/bash
```

단순한 파일시스템 격리일 뿐, 네트워크나 프로세스는 격리되지 않았습니다. 하지만 "경계를 만든다"는 아이디어가 여기서 시작됩니다.

## 2000 — FreeBSD Jails

2000년 FreeBSD 4.0에서 **Jails**가 도입됩니다. `chroot`보다 훨씬 발전된 격리로, 파일시스템뿐 아니라 네트워크 인터페이스, 프로세스, 사용자까지 격리했습니다. 현대 컨테이너의 직접적인 선구자입니다.

Solaris도 2004년 **Zones**라는 유사한 기술을 선보였습니다.

## 2006~2008 — Linux의 두 기둥

Linux에서 컨테이너를 가능하게 한 두 핵심 기술이 이 시기에 정착합니다.

**cgroups (2006)**: Google 엔지니어 Paul Menage와 Rohit Seth가 개발해 Linux 커널 2.6.24에 병합됩니다. 프로세스 그룹의 CPU, 메모리, I/O를 제한하고 계량할 수 있게 됩니다.

**namespaces (2002~2008)**: 여러 커널 버전에 걸쳐 pid, net, mnt, uts, ipc, user namespace가 추가됩니다. 2008년 Linux 2.6.24에서 cgroups와 함께 사용 가능한 형태가 갖춰집니다.

**LXC (Linux Containers, 2008)**: IBM과 Google 등이 cgroups + namespace를 결합한 LXC를 발표합니다. 최초의 완전한 Linux 컨테이너 구현입니다. Docker도 초기에는 LXC를 백엔드로 사용했습니다.

## 2013 — Docker의 등장

2013년 3월 PyCon에서 dotCloud(이후 Docker Inc.)의 Solomon Hykes가 Docker를 발표합니다. 기술적으로 새로운 것은 없었습니다. 혁신은 **사용성**이었습니다.

Docker가 바꾼 것들:

1. **단일 CLI** — `docker build`, `docker run`, `docker push` 세 명령어로 전체 워크플로를 통일
2. **Dockerfile** — 이미지를 코드로 정의하는 선언적 방식
3. **레이어 캐싱** — 변경된 레이어만 다시 빌드하는 효율적인 빌드 시스템
4. **Docker Hub** — 이미지를 공유하는 중앙 레지스트리

```dockerfile
# 2013년 Docker가 가져온 혁명 — 이 단순함이 세상을 바꿨다
FROM ubuntu:12.04
RUN apt-get install -y python
COPY app.py /app/
CMD ["python", "/app/app.py"]
```

![컨테이너 기술의 역사](/assets/posts/docker-history-timeline.svg)

## 2015 — OCI와 표준화

Docker의 폭발적 성장과 함께 생태계 분열 위험이 생겼습니다. Linux Foundation 주도로 **OCI(Open Container Initiative)**가 설립됩니다. 두 가지 표준이 정의됩니다:

- **image-spec**: 컨테이너 이미지 형식 표준
- **runtime-spec**: 컨테이너 실행 환경 표준 (`runc`가 레퍼런스 구현)

같은 해 Google이 Kubernetes 1.0을 발표하고 CNCF(Cloud Native Computing Foundation)에 기증합니다.

## 2017 — containerd와 Moby

Docker는 내부 컨테이너 런타임을 **containerd**로 분리하고 CNCF에 기증합니다. 동시에 Docker의 오픈소스 프로젝트를 **Moby** 프레임워크로 재구성합니다. Docker CE(Community Edition) / EE(Enterprise Edition)로 나뉩니다.

이 시점부터 Kubernetes는 Docker가 아닌 containerd나 다른 CRI 호환 런타임을 직접 사용할 수 있게 됩니다.

## 2020~현재 — 다양화와 성숙

![Docker 생태계의 진화](/assets/posts/docker-history-ecosystem.svg)

- **2020**: Docker Desktop의 기업 사용 유료화 발표 → Podman, nerdctl 같은 대안 도구 주목
- **2021**: BuildKit이 기본 빌드 엔진으로 채택, multi-arch 빌드 표준화
- **2022**: Kubernetes가 공식적으로 dockershim 제거 — containerd/CRI-O 직접 사용
- **2024**: Rootless 모드 안정화, WebAssembly(Wasm) 컨테이너 실험 활발

## 지금의 Docker를 이해하는 핵심

"Docker를 사용한다"는 말은 실제로 여러 계층을 포함합니다:

| 계층 | 구성 요소 |
|------|-----------|
| CLI | `docker` 명령어 |
| API | Docker Engine API (REST) |
| 데몬 | `dockerd` |
| 런타임 | `containerd` → `runc` |
| 커널 | namespace + cgroup |

Docker CLI는 dockerd에 요청을 보내고, dockerd는 containerd를 통해 runc로 실제 컨테이너를 생성합니다. 이 구조는 다음 글에서 더 자세히 살펴봅니다.

## 정리

컨테이너 기술은 1979년 chroot에서 시작해 FreeBSD Jails, Linux namespace/cgroup을 거쳐 2013년 Docker로 대중화됐습니다. OCI 표준화로 특정 벤더 종속에서 벗어났고, 현재는 containerd를 중심으로 다양한 런타임과 도구가 공존하는 성숙한 생태계가 됐습니다. 다음 글에서는 Docker의 전체 아키텍처를 클라이언트-데몬-레지스트리 관점에서 살펴봅니다.

---

**지난 글:** [컨테이너 vs 가상 머신 — 무엇을 선택할까?](/posts/docker-vs-vm/)

**다음 글:** [Docker 아키텍처 완전 이해](/posts/docker-architecture/)

<br>
읽어주셔서 감사합니다. 😊
