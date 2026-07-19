---
title: "docker run 기초 — 컨테이너 실행의 시작"
description: "docker run 명령의 구조, 주요 옵션(-d, -it, --name, -p, -v, --rm), 실행 흐름, 그리고 자주 쓰는 패턴을 예제 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker run", "컨테이너 실행", "CLI", "옵션"]
featured: false
draft: false
---

[지난 글](/posts/docker-context/)에서 Docker Context를 통해 여러 Docker 호스트를 관리하는 방법을 살펴봤습니다. 이제 컨테이너를 직접 다루는 명령어 중 가장 핵심인 `docker run`으로 넘어갑니다. 이 명령 하나로 이미지 Pull부터 컨테이너 생성·실행까지 모든 과정이 자동으로 이루어집니다.

## docker run의 기본 구조

`docker run`은 크게 네 부분으로 구성됩니다.

```text
docker run [OPTIONS] IMAGE [COMMAND] [ARG...]
```

- **OPTIONS**: 실행 방식을 결정하는 플래그 (-d, -it, -p 등)
- **IMAGE**: 기반 이미지. `이름:태그` 형식이 기본 (태그 생략 시 `:latest`)
- **COMMAND**: 컨테이너 내부에서 실행할 명령 (Dockerfile의 CMD를 오버라이드)
- **ARG**: 해당 명령에 전달할 추가 인수

![docker run 명령 해부](/assets/posts/docker-run-basics-anatomy.svg)

명령을 입력하면 Docker는 다음 순서로 작동합니다.

1. **이미지 확인** — 로컬 캐시(`docker image ls`)에 해당 이미지가 있는지 검사
2. **이미지 Pull** — 없으면 설정된 레지스트리(기본: Docker Hub)에서 자동 다운로드
3. **컨테이너 생성** — 이미지 레이어 위에 쓰기 가능한 레이어를 덧씌워 컨테이너 파일시스템 구성
4. **프로세스 시작** — PID 1로 지정한 COMMAND(없으면 이미지 기본 CMD) 실행

## 가장 자주 쓰는 옵션

![docker run 주요 옵션](/assets/posts/docker-run-basics-options.svg)

### -d (Detached mode)

```bash
docker run -d nginx:alpine
# 64자리 컨테이너 ID가 출력되고, 터미널은 즉시 반환됩니다.
```

백그라운드에서 실행되므로 서버형 프로세스(웹 서버, DB 등)에 적합합니다. 컨테이너 출력은 `docker logs <ID>`로 확인합니다.

### -it (Interactive + TTY)

```bash
docker run -it ubuntu:22.04 bash
```

`-i`는 STDIN을 열어두고, `-t`는 가상 터미널(TTY)을 할당합니다. 두 옵션을 함께 써야 쉘과 제대로 상호작용할 수 있습니다. 일회성 디버깅이나 탐색에 유용합니다.

### --name

```bash
docker run -d --name web nginx:alpine
docker stop web   # ID 대신 이름으로 제어
```

이름을 지정하지 않으면 Docker가 무작위 이름을 부여합니다. 컨테이너가 여럿일 때 이름으로 구분하면 관리가 훨씬 편합니다.

### -p (포트 매핑)

```bash
# 호스트 8080 → 컨테이너 80
docker run -d -p 8080:80 nginx:alpine
```

`호스트포트:컨테이너포트` 형식입니다. `0.0.0.0:8080:80`처럼 바인딩 주소를 명시할 수도 있고, `-p 80` 처럼 호스트 포트를 생략하면 사용 가능한 포트를 자동 할당합니다.

### -v (볼륨 마운트)

```bash
# 명명된 볼륨
docker run -v mydata:/var/lib/mysql mysql:8

# 호스트 디렉터리 바인드 마운트
docker run -v $(pwd)/html:/usr/share/nginx/html nginx
```

컨테이너가 삭제돼도 볼륨에 저장된 데이터는 유지됩니다.

### --rm

```bash
docker run --rm alpine sh -c "echo hello && uname -r"
```

컨테이너가 종료되는 즉시 자동 삭제합니다. 스크립트 실행·테스트·빌드 용도의 일회성 컨테이너에 사용하면 좀비 컨테이너가 남지 않습니다.

## 실전 패턴 모음

```bash
# 1. 웹 서버 — 이름, 포트, 백그라운드
docker run -d --name web -p 80:80 nginx:alpine

# 2. 쉘 탐색 — 종료 시 자동 삭제
docker run --rm -it alpine sh

# 3. 환경 변수 주입
docker run -d -e POSTGRES_PASSWORD=secret postgres:16

# 4. 여러 옵션 조합 (실무 전형)
docker run -d \
  --name app \
  -p 3000:3000 \
  -v app_data:/data \
  -e NODE_ENV=production \
  myapp:latest
```

## 자주 하는 실수

**이미지 이름 오타**: `nginx:alpina` 같은 실수는 `Error: No such image` 대신 Pull 실패 메시지로 나타납니다. 태그를 정확히 확인하세요.

**포트 충돌**: 호스트에서 이미 해당 포트를 점유 중이면 `Bind for 0.0.0.0:80 failed` 오류가 발생합니다. `docker ps` 혹은 `ss -tlnp | grep 80` 으로 선점 여부를 확인합니다.

**-d와 -it 동시 사용**: `-d -it`는 가능하지만 대부분 의미 없습니다. 백그라운드 서버 실행은 `-d`, 대화형 탐색은 `-it` 하나만 선택합니다.

## 정리

`docker run`은 옵션 조합만으로 컨테이너의 네트워크, 스토리지, 실행 모드를 모두 결정할 수 있습니다. `-d`로 백그라운드 실행, `-it`로 대화형 접속, `-p`로 포트 연결, `-v`로 데이터 지속성, `--rm`으로 깔끔한 정리 — 이 다섯 가지 패턴만 익혀도 일상적인 컨테이너 작업의 80%를 커버할 수 있습니다.

---

**다음 글:** [docker ps: 실행 중인 컨테이너 조회 완전 정복](/posts/docker-ps/)

<br>
읽어주셔서 감사합니다. 😊
