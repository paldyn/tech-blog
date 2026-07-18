---
title: "Docker Permission Denied 에러 완전 해결 가이드"
description: "docker: Got permission denied while trying to connect to the Docker daemon socket 에러의 원인과 4가지 해결 방법을 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "permission-denied", "docker-group", "rootless", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-cannot-connect-daemon/)에서 Docker 데몬에 연결할 수 없는 문제를 해결했다. 이번에는 데몬은 실행 중인데 막히는 또 다른 대표적인 에러, **Permission Denied**를 다룬다. Docker를 설치한 직후 새 사용자가 `docker` 명령을 처음 실행할 때 가장 많이 마주치는 에러다.

## 에러 메시지 읽기

```text
$ docker run hello-world
docker: Got permission denied while trying to connect to the
Docker daemon socket at unix:///var/run/docker.sock:
Post "http://%2Fvar%2Frun%2Fdocker.sock/v1.24/containers/create":
dial unix /var/run/docker.sock: connect: permission denied.
```

메시지가 길지만 핵심은 한 줄이다: `/var/run/docker.sock`에 접근할 권한이 없다. Docker CLI는 이 유닉스 소켓을 통해 `dockerd` 데몬과 통신한다. 소켓 파일의 소유권을 확인하면 원인이 바로 보인다.

```bash
$ ls -la /var/run/docker.sock
srw-rw---- 1 root docker 0 May 26 09:00 /var/run/docker.sock
```

소켓의 그룹이 `docker`이고 그룹에 읽기·쓰기(rw) 권한이 있다. 즉 **`docker` 그룹에 속한 사용자라면 `sudo` 없이도 소켓에 접근할 수 있다**. 반대로 그룹에 없으면 접근이 차단된다.

![Permission Denied 에러 발생 흐름](/assets/posts/docker-permission-denied-flow.svg)

## 원인 진단

```bash
# 현재 사용자가 속한 그룹 목록 확인
$ groups
user adm cdrom sudo dip plugdev lpadmin

# docker 그룹이 있는지 확인
$ getent group docker
docker:x:999:
# 사용자 이름이 없으면 미포함 상태
```

`groups` 출력에 `docker`가 없고, `getent group docker` 뒤에 사용자 이름이 없으면 그룹 미포함이 원인이다.

## 해결 방법 4가지

![Permission Denied 해결 방법](/assets/posts/docker-permission-denied-solutions.svg)

### 방법 1: docker 그룹에 사용자 추가 (권장)

```bash
# docker 그룹에 현재 사용자 추가
sudo usermod -aG docker $USER

# 적용 확인 (로그아웃 후 재로그인 필요)
# 또는 newgrp으로 즉시 적용
newgrp docker

# 정상 동작 확인
docker run hello-world
```

`usermod -aG`의 `-a`는 append(추가)를 의미한다. `-a` 없이 `-G`만 쓰면 기존 그룹이 **모두 삭제**되니 반드시 `-aG`로 써야 한다.

변경사항은 **새 로그인 세션부터** 적용된다. 현재 터미널에 바로 적용하려면 `newgrp docker`를 실행한다.

### 방법 2: newgrp로 즉시 적용

```bash
# 현재 셸에서 즉시 docker 그룹 활성화
newgrp docker

# 이후 docker 명령이 정상 동작
docker ps
```

`newgrp`는 현재 셸 세션의 그룹을 전환한다. 새 터미널을 열면 다시 실행해야 하므로, `usermod`와 함께 사용하는 게 일반적이다.

### 방법 3: sudo 임시 사용 (비권장)

```bash
sudo docker run nginx
sudo docker ps
```

빠른 테스트에는 쓸 수 있지만, 매번 `sudo`를 입력해야 하고 루트 권한으로 컨테이너가 실행되어 보안상 좋지 않다. 장기 사용에는 적합하지 않다.

### 방법 4: Rootless Docker

```bash
# Rootless Docker 설치 (데몬 자체를 루트 없이 실행)
dockerd-rootless-setuptool.sh install

# 환경변수 설정
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock
```

데몬 자체를 루트 없이 실행하는 방식으로, 보안상 가장 강력하다. CI/CD 파이프라인이나 공유 서버 환경에 적합하다.

## docker 그룹의 보안 고려

```bash
# docker 그룹 멤버 확인
getent group docker

# 호스트 루트 접근 가능 예시 (보안 위험)
docker run -v /:/host -it ubuntu chroot /host
```

`docker` 그룹에 속한 사용자는 위처럼 호스트 루트 파일시스템에 접근할 수 있다. 실질적으로 **루트와 동등한 권한**을 갖는 셈이다. 따라서 신뢰할 수 있는 사용자에게만 그룹을 부여해야 한다. 공유 서버나 다중 사용자 환경이라면 Rootless Docker를 우선 검토한다.

## CI/CD 환경 처리

GitHub Actions 같은 CI 환경에서는 Runner가 이미 `docker` 그룹에 속해 있는 경우가 많다. 만약 그렇지 않다면:

```yaml
# GitHub Actions 예시
- name: Docker 설정
  uses: docker/setup-buildx-action@v3

# 또는 직접 소켓 권한 조정
- run: sudo chmod 666 /var/run/docker.sock
```

`chmod 666`은 모든 사용자에게 소켓 접근을 허용하므로 CI 격리 환경에서만 쓴다. 프로덕션 서버에는 절대 사용하지 않는다.

---

**지난 글:** [Docker 데몬 연결 실패 트러블슈팅](/posts/docker-cannot-connect-daemon/)

**다음 글:** [No space left on device 에러 해결](/posts/docker-no-space-left/)

<br>
읽어주셔서 감사합니다. 😊
