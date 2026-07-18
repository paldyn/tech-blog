---
title: "Podman vs Docker — 데몬리스 컨테이너 런타임 비교"
description: "Docker와 Podman의 아키텍처 차이, rootless 컨테이너, Pod 지원, 명령어 호환성까지 실무 관점에서 비교하고 마이그레이션 방법을 안내합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "podman", "rootless", "daemonless", "container-runtime", "rhel", "oci"]
featured: false
draft: false
---

[지난 글](/posts/docker-runc-containerd/)에서 Docker 런타임 스택의 계층 구조를 살펴봤다. 이번에는 Docker의 강력한 대안으로 떠오른 **Podman**을 비교 분석한다. "데몬리스(daemonless)"라는 키워드가 무엇을 의미하는지, 실무에서 언제 Podman을 선택해야 하는지를 다룬다.

## Podman이란

Podman은 Red Hat이 주도하는 OCI 호환 컨테이너 툴이다. Docker와 달리 **백그라운드 데몬이 없고**, 각 `podman` 명령이 직접 컨테이너를 생성·관리한다.

```bash
# Podman 설치 (Ubuntu)
sudo apt install podman

# 버전 확인
podman version

# Docker 명령 그대로 alias 설정
alias docker=podman
docker run -it alpine sh  # podman이 실행됨
```

## 아키텍처 비교

![Docker vs Podman 아키텍처](/assets/posts/docker-podman-vs-docker-arch.svg)

Docker의 핵심 차이는 **dockerd(root 데몬)의 존재**다. 모든 `docker` 명령은 이 데몬을 통하므로, 데몬이 죽으면 컨테이너 관리가 불가능해진다. 또한 `/var/run/docker.sock`에 접근 가능한 사용자는 사실상 root 권한을 갖는다.

Podman은 데몬 없이 각 명령이 직접 `runc`를 호출한다. 컨테이너당 경량 모니터 프로세스(`conmon`)만 남기고 CLI 자체는 종료된다.

## 기능 비교

![Docker vs Podman 기능 비교](/assets/posts/docker-podman-vs-docker-compare.svg)

## Rootless 컨테이너

Podman의 가장 큰 강점이다. 일반 사용자 권한으로 컨테이너를 실행할 수 있어 보안이 중요한 환경에서 선호된다.

```bash
# 일반 사용자로 컨테이너 실행 (sudo 불필요)
podman run -d --name web nginx

# 사용자 Namespace 매핑 확인
podman unshare cat /proc/self/uid_map
# 0  1000  1  (컨테이너 UID 0 → 호스트 UID 1000)

# rootless 스토리지 위치 (홈 디렉터리 아래)
podman info | grep graphRoot
# /home/user/.local/share/containers/storage
```

Docker도 rootless를 지원하지만 별도 설정이 필요하고, 기본값은 root 데몬이다.

## Pod 지원

Podman은 쿠버네티스의 **Pod 개념을 로컬에서 재현**한다. 같은 Pod의 컨테이너는 네트워크 Namespace를 공유한다.

```bash
# Pod 생성
podman pod create --name mypod -p 8080:80

# Pod에 컨테이너 추가
podman run -d --pod mypod --name web nginx
podman run -d --pod mypod --name app myapp:latest

# Pod 상태 확인
podman pod ps
podman pod inspect mypod

# Pod → K8s YAML 변환 (실제 배포용)
podman generate kube mypod > mypod.yaml
kubectl apply -f mypod.yaml
```

## Docker Compose 대체 — Quadlet

RHEL 8+/Fedora에서 Podman은 **Quadlet**으로 systemd 유닛 파일처럼 컨테이너를 선언할 수 있다. 또한 `podman-compose`로 기존 Compose 파일을 그대로 사용할 수도 있다.

```bash
# podman-compose 설치 및 사용
pip install podman-compose
podman-compose up -d

# Quadlet 유닛 파일 예시 (~/.config/containers/systemd/web.container)
# [Container]
# Image=nginx
# PublishPort=8080:80
# [Service]
# Restart=always

# 유닛 활성화
systemctl --user daemon-reload
systemctl --user start web
```

## 이미지 호환성

Podman은 Docker Hub를 포함한 OCI 레지스트리를 그대로 사용한다. 이미지 형식이 OCI 표준이므로 완전 호환된다.

```bash
# Docker Hub에서 pull
podman pull docker.io/library/nginx:latest

# 단축 이름 설정 (/etc/containers/registries.conf)
# [registries.search]
# registries = ["docker.io", "quay.io"]
podman pull nginx  # docker.io/library/nginx로 해석

# 이미지 목록
podman images

# Docker 이미지를 Podman으로 가져오기
docker save myimage:latest | podman load
```

## 언제 Podman을 선택하는가

| 상황 | 권장 |
|---|---|
| RHEL/CentOS 환경 | Podman (기본 탑재) |
| 보안 강화 필요, 루트 권한 제한 | Podman (rootless) |
| 로컬 개발, Docker Desktop 대체 | Docker 또는 Podman |
| CI/CD 파이프라인 | 둘 다 가능 |
| Kubernetes YAML 직접 생성 | Podman (generate kube) |
| 기존 Docker 스크립트 유지 | Docker (호환성) |

## 마이그레이션 체크리스트

```bash
# 1. 명령어 alias
alias docker=podman
alias docker-compose=podman-compose

# 2. 기존 이미지 확인 및 변환
docker images --format '{{.Repository}}:{{.Tag}}' | \
  xargs -I{} podman pull {}

# 3. 볼륨 데이터 마이그레이션
docker run --rm -v myvolume:/src alpine tar cf - -C /src . | \
  podman run --rm -i -v myvolume:/dst alpine tar xf - -C /dst

# 4. 소켓 경로 변경 (CI 도구용)
export DOCKER_HOST=unix:///run/user/1000/podman/podman.sock
```

---

**지난 글:** [runc & containerd — Docker 런타임 스택 해부](/posts/docker-runc-containerd/)

**다음 글:** [nerdctl — containerd용 Docker 호환 CLI](/posts/docker-nerdctl/)

<br>
읽어주셔서 감사합니다. 😊
