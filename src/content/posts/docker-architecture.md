---
title: "Docker 아키텍처 완전 이해 — 클라이언트·데몬·레지스트리"
description: "Docker CLI, dockerd, containerd, runc, Registry까지 각 컴포넌트의 역할과 통신 방식을 명확하게 이해합니다. docker run 한 줄로 무슨 일이 벌어지는지 추적합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["Docker", "dockerd", "containerd", "runc", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/docker-history/)에서 Docker가 containerd, runc, OCI로 진화하는 과정을 살펴봤습니다. 그렇다면 현재 Docker 시스템은 내부적으로 어떻게 구성되어 있을까요? `docker run nginx`라는 한 줄 명령에 어떤 컴포넌트들이 관여하고, 어떤 통신을 주고받는지 추적해 봅니다.

## 전체 구조: 세 영역

Docker 아키텍처는 크게 세 영역으로 나뉩니다.

```text
[ Docker Client ]  ←→  [ Docker Host ]  ←→  [ Registry ]
     docker CLI          dockerd              Docker Hub
                         containerd           ECR / GCR
                         runc                 Private
```

![Docker 아키텍처 전체 구조](/assets/posts/docker-architecture-overview.svg)

## Docker Client

사용자가 직접 상호작용하는 도구입니다. `docker` CLI가 대표적이지만, Docker Desktop의 GUI나 CI 도구도 모두 클라이언트입니다.

클라이언트는 직접 컨테이너를 실행하지 않습니다. **REST API**를 통해 Docker 데몬(dockerd)에 요청을 보낼 뿐입니다. 기본적으로 Unix 도메인 소켓(`/var/run/docker.sock`)을 사용하고, TCP를 통해 원격 호스트의 데몬에도 연결할 수 있습니다.

```bash
# docker.sock을 통한 API 직접 호출 예시
curl --unix-socket /var/run/docker.sock http://v1.41/version
```

## Docker Daemon (dockerd)

`dockerd`는 Docker의 핵심 데몬 프로세스입니다. 클라이언트의 API 요청을 받아 처리합니다.

주요 책임:
- 이미지 빌드, 관리, 레지스트리 pull/push
- 컨테이너 생성·시작·중지·삭제
- 네트워크 및 볼륨 관리

그러나 `dockerd` 자체가 컨테이너를 직접 실행하지는 않습니다. 실제 실행은 **containerd**에 위임합니다.

```bash
# dockerd 상태 확인
systemctl status docker

# dockerd 로그 확인
journalctl -u docker.service -f
```

## containerd

**containerd**는 컨테이너 라이프사이클을 관리하는 데몬입니다. 2017년 CNCF에 기증된 업계 표준 런타임입니다.

containerd가 담당하는 것:
- OCI 이미지 pull/push 및 스토리지
- 컨테이너 네임스페이스 관리
- snapshotter(OverlayFS 등)를 통한 레이어 스토리지
- runc에 컨테이너 실행 위임

Kubernetes도 직접 containerd를 CRI(Container Runtime Interface) 런타임으로 사용합니다.

## runc

**runc**는 OCI runtime-spec을 구현한 로우레벨 런타임입니다. 실제로 Linux 커널에 시스템 콜을 호출해 namespace를 생성하고 cgroup을 설정하고 프로세스를 시작합니다.

```bash
# runc 버전 확인 (직접 설치된 경우)
runc --version
```

runc는 컨테이너 프로세스를 시작한 뒤 종료합니다. 컨테이너 프로세스가 runc의 자식이 되는 것이 아니라, init 프로세스 계층 아래에서 독립적으로 실행됩니다.

## Registry

Registry는 이미지를 저장하고 배포하는 서버입니다. `docker pull`은 Registry에서 이미지 레이어를 가져오고, `docker push`는 레이어를 업로드합니다.

| Registry | 설명 |
|----------|------|
| Docker Hub | 기본 공개 레지스트리 (`docker.io`) |
| ECR | AWS Elastic Container Registry |
| GCR/Artifact Registry | Google Cloud |
| GHCR | GitHub Container Registry |
| Harbor, Nexus | 자체 호스팅 프라이빗 레지스트리 |

## docker run의 실행 흐름

`docker run nginx` 명령 하나를 추적해 봅니다.

![docker run 실행 흐름](/assets/posts/docker-architecture-flow.svg)

1. **CLI 파싱**: `docker run nginx`를 파싱해 API 요청으로 변환
2. **API 호출**: `POST /containers/create`를 dockerd에 전송 (unix socket)
3. **이미지 확인**: dockerd가 로컬 캐시 확인 → 없으면 Docker Hub에서 pull
4. **컨테이너 생성**: dockerd → containerd → runc 순서로 명령 전달
5. **프로세스 시작**: runc가 namespace/cgroup 설정 후 `nginx` 프로세스를 PID 1로 시작

전체 과정은 이미지가 로컬에 있다면 수백 밀리초 내에 완료됩니다.

## 원격 Docker Host 연결

`DOCKER_HOST` 환경 변수로 원격 데몬에 연결할 수 있습니다.

```bash
# 원격 Docker Host 연결 (TLS 권장)
export DOCKER_HOST=tcp://192.168.1.100:2376
export DOCKER_TLS_VERIFY=1
docker ps

# docker context를 사용하는 현대적 방식 (권장)
docker context create remote --docker "host=ssh://user@192.168.1.100"
docker context use remote
```

## 컴포넌트 버전 확인

```bash
# 전체 버전 정보
docker version

# Client와 Server(daemon) 버전이 별도로 표시됨
# Server 항목에서 containerd, runc 버전도 확인 가능
docker info | grep -E "Runtime|containerd|runc"
```

## 정리

Docker 아키텍처는 `docker CLI` → `dockerd` → `containerd` → `runc`의 계층 구조입니다. CLI는 REST API를 통해 데몬에 명령을 전달하고, 이미지는 Registry에서 가져옵니다. 각 계층이 잘 분리되어 있어 containerd를 직접 사용하거나, runc 대신 다른 OCI 런타임을 교체하는 것도 가능합니다. 다음 글에서는 이 구조의 중심인 Docker 데몬의 내부 동작을 더 깊이 파고듭니다.

---

**지난 글:** [Docker의 역사 — chroot에서 OCI 표준까지](/posts/docker-history/)

**다음 글:** [Docker 엔진과 데몬 — dockerd 내부 동작](/posts/docker-engine-daemon/)

<br>
읽어주셔서 감사합니다. 😊
