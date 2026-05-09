---
title: "docker exec — 실행 중인 컨테이너에 명령 실행"
description: "docker exec의 동작 원리, -it/-d/-e/-w 옵션, 쉘 진입·단건 명령·디버깅 패턴, 그리고 컨테이너에 bash가 없을 때 대처법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker exec", "쉘 진입", "디버깅", "CLI"]
featured: false
draft: false
---

[지난 글](/posts/docker-rm/)에서 불필요한 컨테이너를 정리하는 방법을 살펴봤습니다. 이번에는 실행 중인 컨테이너 내부에 접근하거나 명령을 실행하는 `docker exec`를 다룹니다.

## docker exec란?

`docker exec`는 **이미 실행 중인 컨테이너**에 새로운 프로세스를 추가로 실행합니다. 기존 PID 1 프로세스는 그대로 두고, 같은 네임스페이스(네트워크, 파일시스템, 마운트 등)를 공유하는 신규 프로세스를 생성합니다.

![docker exec 실행 흐름](/assets/posts/docker-exec-flow.svg)

`docker run`과의 핵심 차이는 다음과 같습니다.

- `docker run`: 새 컨테이너를 만들어서 실행
- `docker exec`: 기존 실행 중인 컨테이너에 프로세스 추가

## 기본 문법

```bash
docker exec [OPTIONS] CONTAINER COMMAND [ARG...]
```

## 주요 옵션

| 옵션 | 설명 |
|------|------|
| `-i` | STDIN 유지 (파이프·스크립트에 필요) |
| `-t` | 가상 터미널(TTY) 할당 |
| `-d` | 백그라운드에서 명령 실행 |
| `-e KEY=VAL` | 환경 변수 추가 |
| `-w /path` | 작업 디렉터리 지정 |
| `-u user` | 실행 사용자 지정 |

## 주요 사용 패턴

![docker exec 실전 활용 패턴](/assets/posts/docker-exec-usecases.svg)

### 쉘 진입 (가장 흔한 패턴)

```bash
# bash가 있는 컨테이너
docker exec -it web bash

# Alpine 계열 (bash 없음 → sh 사용)
docker exec -it alpine-container sh

# 특정 사용자로 진입
docker exec -it -u www-data web bash
```

### 단건 명령 실행

```bash
# nginx 설정 문법 검사
docker exec web nginx -t

# 컨테이너 내부 파일 확인
docker exec web cat /etc/nginx/nginx.conf

# 환경 변수 목록 확인
docker exec web env | grep DB_

# nginx 무중단 설정 리로드
docker exec web nginx -s reload
```

### 백그라운드 실행 (-d)

```bash
# 컨테이너 내부에서 백그라운드 스크립트 실행
docker exec -d web /scripts/maintenance.sh
```

### 작업 디렉터리 지정 (-w)

```bash
docker exec -it -w /app web npm run lint
```

## 컨테이너에 bash가 없을 때

Distroless, Alpine, Scratch 이미지 등은 bash가 없습니다.

```bash
# Alpine: sh 사용
docker exec -it myapp sh

# bash 설치 후 사용 (임시)
docker exec -it myapp /bin/sh
```

만약 `sh`도 없다면 (`Distroless`, `scratch` 기반) `docker exec`가 불가능합니다. 이 경우 ephemeral container(`kubectl debug`)나 `nsenter` 같은 도구를 활용합니다.

## exec 실행 중인 프로세스 확인

`docker exec`로 실행한 프로세스는 `docker top`으로 확인할 수 있습니다.

```bash
docker top web     # 컨테이너 내 모든 프로세스 표시
```

exec 프로세스를 종료하려면 쉘에서 `exit`하거나 `Ctrl+D`를 입력합니다. **exec 프로세스가 종료돼도 컨테이너(PID 1)는 계속 실행**됩니다.

## 정리

`docker exec -it CONTAINER bash`는 운영 중인 컨테이너를 직접 들여다볼 수 있는 가장 빠른 방법입니다. 단건 명령으로 설정 파일 확인, 프로세스 점검, 무중단 리로드 등 실무 디버깅에 폭넓게 쓰입니다.

---

**지난 글:** [docker rm — 컨테이너 삭제 완전 정복](/posts/docker-rm/)

**다음 글:** [docker attach vs exec — 차이점과 활용법](/posts/docker-attach-vs-exec/)

<br>
읽어주셔서 감사합니다. 😊
