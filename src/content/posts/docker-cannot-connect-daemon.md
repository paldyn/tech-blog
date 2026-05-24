---
title: "Docker 데몬 연결 오류 해결하기"
description: "\"Cannot connect to the Docker daemon\" 오류의 원인 분류(데몬 미실행·소켓 권한·DOCKER_HOST 설정 오류·컨텍스트 문제), 환경별(Linux·macOS·CI) 해결 명령, rootless 모드 주의사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "트러블슈팅", "daemon", "socket", "permission", "devops"]
featured: false
draft: false
---

[지난 글](/posts/docker-dockerignore/)에서 `.dockerignore`로 빌드 컨텍스트를 최소화하는 방법을 다뤘다. Docker를 처음 쓰거나 환경이 바뀐 후 가장 흔하게 만나는 오류가 **"Cannot connect to the Docker daemon at unix:///var/run/docker.sock"**이다. 원인은 크게 네 가지이고 각각 해결법이 다르다.

## 오류 메시지 전문

```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock.
Is the docker daemon running?
```

또는:

```
permission denied while trying to connect to the Docker daemon socket
at unix:///var/run/docker.sock
```

두 메시지는 다른 원인이다. 전자는 데몬이 안 떠 있거나 소켓 경로가 다른 것이고, 후자는 소켓에 대한 읽기·쓰기 권한이 없는 것이다.

## 진단 흐름

![데몬 연결 오류 진단 트리](/assets/posts/docker-cannot-connect-daemon-diagnosis.svg)

## 원인 1: 데몬이 실행되지 않음

```bash
# 데몬 상태 확인
systemctl status docker

# 실행 중이 아니면 시작
sudo systemctl start docker

# 부팅 시 자동 시작 등록
sudo systemctl enable docker

# macOS — Docker Desktop이 실행됐는지 확인
open -a Docker
```

Docker Desktop(macOS/Windows)은 시스템 트레이에서 고래 아이콘이 보여야 한다. 아이콘이 없으면 앱을 다시 실행한다.

## 원인 2: docker 그룹 권한 없음

Linux에서 `sudo` 없이 docker 명령을 실행할 때 발생한다.

```bash
# 현재 사용자의 그룹 확인
id
# uid=1000(alice) gid=1000(alice) groups=1000(alice),27(sudo)
# ← docker 그룹 없음

# docker 그룹에 사용자 추가
sudo usermod -aG docker $USER

# 현재 세션에서 즉시 적용 (재로그인 불필요)
newgrp docker

# 적용 확인
id
# groups=... 24(docker) ...

# 테스트
docker ps
```

`newgrp docker`는 새 쉘을 열어 그룹을 적용한다. 완전히 적용하려면 로그아웃 후 재로그인이 필요하다.

## 환경별 해결 명령

![환경별 해결 명령 모음](/assets/posts/docker-cannot-connect-daemon-fixes.svg)

## 원인 3: DOCKER_HOST 환경 변수 오설정

원격 Docker 호스트를 가리키거나 잘못된 값이 설정된 경우다.

```bash
# 현재 설정 확인
echo $DOCKER_HOST
# tcp://192.168.99.100:2376   ← 이전 Docker Machine 잔여물

# 로컬 데몬을 기본으로 복구
unset DOCKER_HOST

# 또는 명시적으로 로컬 소켓 지정
export DOCKER_HOST=unix:///var/run/docker.sock
```

예전에 Docker Machine이나 Minikube를 사용한 후 환경 변수가 남아 있는 경우 자주 발생한다.

## 원인 4: Docker 컨텍스트 문제

```bash
# 현재 컨텍스트 목록 확인
docker context ls
# NAME        DESCRIPTION    DOCKER ENDPOINT
# default *   ...            unix:///var/run/docker.sock
# remote      ...            tcp://10.0.0.5:2376   ← 이걸 가리키고 있다면

# 로컬 컨텍스트로 전환
docker context use default

# 특정 소켓을 직접 지정하여 테스트
docker -H unix:///var/run/docker.sock ps
```

## macOS — Docker Desktop 소켓 경로

macOS에서 Docker Desktop은 기본 소켓 경로가 다를 수 있다.

```bash
# 실제 소켓 경로 확인
ls /var/run/docker.sock
ls ~/.docker/run/docker.sock          # Docker Desktop 4.x+
ls /Users/$USER/.docker/run/docker.sock

# 특정 경로로 직접 테스트
docker -H unix:///Users/$USER/.docker/run/docker.sock ps

# .zshrc나 .bashrc에 추가
export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock
```

## CI 환경 — DinD 소켓 마운트

Jenkins나 GitLab CI 컨테이너 안에서 Docker를 실행할 때는 호스트 소켓을 마운트해야 한다.

```yaml
# GitLab CI
variables:
  DOCKER_HOST: unix:///var/run/docker.sock

services:
  - docker:24-dind

job:
  image: docker:24
  script:
    - docker ps
```

```yaml
# docker-compose로 Jenkins 실행 시
services:
  jenkins:
    image: jenkins/jenkins:lts
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    user: root   # 또는 jenkins 유저를 docker 그룹에 추가
```

소켓을 마운트할 때 컨테이너 안의 사용자도 `docker` 그룹에 속해야 한다. `user: root`로 임시 해결할 수 있지만, 보안상 jenkins 사용자를 `docker` 그룹에 추가하는 것이 더 안전하다.

## rootless Docker 주의사항

rootless 모드에서는 소켓 경로가 다르다.

```bash
# rootless 소켓 경로
ls /run/user/$(id -u)/docker.sock

# 환경 변수 설정
export DOCKER_HOST=unix:///run/user/$(id -u)/docker.sock

# systemd 서비스로 실행
systemctl --user status docker
systemctl --user start docker
```

rootless 모드는 `/var/run/docker.sock`이 아니라 사용자 단위 소켓을 사용한다. `sudo`를 쓰지 않아도 되는 대신 소켓 경로를 명시해야 한다.

## 빠른 진단 스크립트

```bash
#!/bin/bash
echo "=== Docker 연결 진단 ==="
echo "DOCKER_HOST: ${DOCKER_HOST:-'(unset, defaults to unix socket)'}"
echo ""
echo "--- 소켓 확인 ---"
ls -la /var/run/docker.sock 2>/dev/null || echo "소켓 없음"
echo ""
echo "--- 그룹 확인 ---"
id | grep -o 'docker' || echo "docker 그룹 미포함"
echo ""
echo "--- 데몬 상태 ---"
systemctl is-active docker 2>/dev/null || echo "systemd 없음 (macOS?)"
echo ""
echo "--- 컨텍스트 ---"
docker context ls 2>/dev/null
echo ""
echo "--- 연결 테스트 ---"
docker version && echo "✓ 연결 성공" || echo "✗ 연결 실패"
```

---

**지난 글:** [.dockerignore — 빌드 컨텍스트를 최소화하는 방법](/posts/docker-dockerignore/)

<br>
읽어주셔서 감사합니다. 😊
