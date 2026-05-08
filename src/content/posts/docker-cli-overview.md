---
title: "Docker CLI 완전 가이드 — 명령어 체계 총정리"
description: "Docker CLI의 Management Commands 체계, 주요 명령어 카테고리, --format과 --filter 활용법, 환경 변수와 alias까지 CLI를 제대로 쓰는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["Docker", "CLI", "docker ps", "docker inspect", "docker run"]
featured: false
draft: false
---

[지난 글](/posts/docker-engine-daemon/)에서 dockerd의 내부 구조를 살펴봤습니다. 이제 실제로 Docker를 사용하는 인터페이스, CLI를 체계적으로 이해할 차례입니다. 수십 가지 명령어가 있지만, 구조를 파악하면 외울 필요 없이 필요한 명령을 스스로 찾을 수 있습니다.

## CLI 명령어 체계: Management Commands

Docker 1.13(2017)부터 **Management Commands** 체계가 도입됐습니다. 명령어를 대상 리소스 타입 기준으로 분류합니다.

```bash
docker <object> <action>

# 예시
docker container ls        # 컨테이너 목록
docker image pull nginx    # 이미지 다운로드
docker volume create mydb  # 볼륨 생성
docker network inspect br0 # 네트워크 상세 정보
```

기존 단축 명령어(`docker ps`, `docker images`)도 여전히 작동합니다. `docker container ls`와 `docker ps`는 완전히 동일합니다. Management Commands 형식이 더 명시적이고 자동완성이 잘 됩니다.

![Docker CLI 명령어 카테고리](/assets/posts/docker-cli-overview-categories.svg)

## 자주 쓰는 명령어 빠른 참조

### 컨테이너

```bash
# 실행 (백그라운드, 이름 지정, 포트 매핑)
docker run -d --name web -p 80:80 nginx

# 실행 중 컨테이너 목록
docker ps

# 모든 컨테이너 (중지 포함)
docker ps -a

# 컨테이너 로그 (실시간)
docker logs -f web

# 컨테이너 내부 셸 진입
docker exec -it web bash

# 중지 / 시작 / 재시작 / 삭제
docker stop web && docker rm web
```

### 이미지

```bash
# 이미지 다운로드
docker pull ubuntu:22.04

# 로컬 이미지 목록
docker images

# 이미지 빌드
docker build -t myapp:1.0 .

# 이미지 삭제
docker rmi myapp:1.0
```

### 정리

```bash
# 중지된 컨테이너, 미사용 이미지, 네트워크, 볼륨 일괄 삭제
docker system prune -a --volumes

# 디스크 사용량 확인
docker system df
```

## --help 계층 활용

CLI에서 모르는 게 있으면 `--help`를 붙이는 습관이 가장 중요합니다.

```bash
docker --help              # 전체 명령어 목록
docker container --help    # container 하위 명령 목록
docker run --help          # run 플래그 전체 목록
```

## --format 플래그: Go template 출력

`docker ps`, `docker inspect`, `docker images` 등에 `--format`으로 출력 형식을 제어할 수 있습니다.

```bash
# 이름과 상태만 테이블 형식으로
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ID만 추출 (스크립트에서 유용)
docker ps -q

# 이미지 이름과 크기
docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}"
```

## --filter 플래그

```bash
# 상태로 필터
docker ps --filter "status=exited"

# 이름으로 필터
docker ps --filter "name=web"

# 이미지로 필터
docker ps --filter "ancestor=nginx"

# 라벨로 필터
docker ps --filter "label=env=production"
```

## inspect + jq: 가장 강력한 진단 조합

`docker inspect`는 컨테이너/이미지/네트워크/볼륨 등의 상세 정보를 JSON으로 출력합니다.

```bash
# 컨테이너 IP 주소 추출
docker inspect web | jq '.[0].NetworkSettings.IPAddress'

# 마운트된 볼륨 목록
docker inspect web | jq '.[0].Mounts'

# 환경 변수 목록
docker inspect web | jq '.[0].Config.Env'

# --format으로 jq 없이 동일하게
docker inspect --format '{{.NetworkSettings.IPAddress}}' web
```

![Docker CLI 필수 사용법](/assets/posts/docker-cli-overview-tips.svg)

## 환경 변수와 alias

자주 쓰는 옵션은 환경 변수나 alias로 등록해 두면 생산성이 크게 높아집니다.

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
alias dlog='docker logs --tail=50 -f'
alias dex='docker exec -it'
alias dip='docker inspect --format "{{.NetworkSettings.IPAddress}}"'

# 원격 Docker 호스트 연결
export DOCKER_HOST=ssh://user@remote-host
```

## 자동완성 설정

Docker CLI는 bash/zsh/fish 자동완성을 제공합니다.

```bash
# zsh (oh-my-zsh 사용 시 plugins에 docker 추가)
plugins=(docker docker-compose git)

# bash
source /usr/share/bash-completion/completions/docker
```

자동완성이 있으면 컨테이너 이름, 이미지 이름, 플래그를 Tab으로 완성할 수 있어 오타가 크게 줄어듭니다.

## 정리

Docker CLI는 `docker <object> <action>` 구조의 Management Commands 체계를 가집니다. `--help`로 언제든 사용법을 확인할 수 있고, `--format`과 `--filter`로 출력을 제어하며, `docker inspect + jq`로 깊은 진단이 가능합니다. 다음 글에서는 Docker를 실제 시스템에 설치하는 방법을 Linux, macOS, Windows 각각에서 다룹니다.

---

**지난 글:** [Docker 엔진과 데몬 — dockerd 내부 동작](/posts/docker-engine-daemon/)

**다음 글:** [Docker 설치 완전 가이드 — Linux · macOS · Windows](/posts/docker-install/)

<br>
읽어주셔서 감사합니다. 😊
