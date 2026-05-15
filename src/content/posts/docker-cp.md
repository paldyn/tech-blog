---
title: "docker cp — 컨테이너와 호스트 간 파일 복사"
description: "docker cp 명령으로 호스트와 컨테이너 사이에 파일과 디렉터리를 복사하는 방법, tar 스트림 활용, 실전 패턴, 그리고 운영 시 주의 사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "cp", "file-copy", "container"]
featured: false
draft: false
---

[지난 글](/posts/docker-port/)에서 포트 매핑을 확인하는 방법을 다뤘다. 이번에는 호스트와 컨테이너 사이에서 파일을 주고받는 `docker cp` 명령을 살펴본다. 볼륨을 마운트하지 않고도 컨테이너 내부 파일에 접근하거나, 빌드 결과물을 추출하는 데 자주 쓰이는 필수 도구다.

## docker cp 기본 개념

`docker cp`는 Linux `cp` 명령과 유사한 인터페이스로 호스트 ↔ 컨테이너 간 파일을 복사한다. 핵심적인 차이는 **실행 중인 컨테이너뿐 아니라 중지된 컨테이너에도 동작**한다는 점이다. Docker가 OverlayFS 레이어에 직접 접근하기 때문이다.

```bash
# 문법
docker cp <src> <dest>

# src 또는 dest 중 하나가 컨테이너 경로여야 한다
# 형식: CONTAINER:path
```

![파일 복사 방향](/assets/posts/docker-cp-flow-diagram.svg)

## 호스트 → 컨테이너

```bash
# 단일 파일 복사
docker cp ./app.conf web:/etc/nginx/conf.d/

# 디렉터리 복사 (디렉터리 자체를 복사)
docker cp ./config/ web:/etc/

# 디렉터리 내용물만 복사 (끝에 . 추가)
docker cp ./dist/. web:/app/static/
```

경로 끝의 슬래시와 점(`.`) 처리가 Linux `cp -r`과 동일하다. `./dist/`는 `dist` 디렉터리 자체를, `./dist/.`는 내용물만 목적지에 넣는다.

## 컨테이너 → 호스트

```bash
# 파일 추출
docker cp web:/etc/nginx/nginx.conf .

# 디렉터리 통째로 추출
docker cp web:/var/log/nginx/ ./backup/
```

이 패턴은 컨테이너에서 생성된 데이터나 로그를 호스트로 가져올 때 유용하다.

## tar 스트림 활용

`-`를 경로로 지정하면 stdin/stdout으로 tar 스트림을 주고받을 수 있다.

```bash
# 컨테이너 → stdout tar
docker cp web:/app - | tar xf -

# stdin tar → 컨테이너
tar cf - ./files | docker cp - web:/app/
```

파이프 방식은 임시 파일 없이 여러 파일을 한 번에 전송하거나, 다른 컨테이너로 데이터를 릴레이할 때 편리하다.

## 실전 패턴

![docker cp 명령 패턴](/assets/posts/docker-cp-commands.svg)

**빌드 결과물 추출:** 컨테이너를 실행하지 않고 이미지에서 파일만 꺼낼 수 있다.

```bash
# 컨테이너 생성(실행 없이) → cp → 삭제
CID=$(docker create my-builder)
docker cp "$CID":/app/dist ./dist
docker rm "$CID"
```

멀티 스테이지 빌드의 대안이 아니라 보완 패턴이다. CI에서 이미지 없이 단순히 파일을 뽑아낼 때 빠르다.

**설정 핫픽스:** 긴급 상황에서 이미지 재빌드 없이 설정 파일을 교체하고 프로세스를 재로드할 수 있다.

```bash
docker cp hotfix.conf web:/etc/app/conf.d/
docker exec web nginx -s reload
```

단, 이 변경은 이미지 레이어에 반영되지 않으므로 컨테이너가 재생성되면 사라진다. 반드시 후속 조치로 Dockerfile을 업데이트해야 한다.

## 주의 사항

심볼릭 링크를 복사할 때는 링크 자체가 아니라 **링크가 가리키는 파일**이 복사된다. 파일 퍼미션과 소유자 정보는 기본적으로 보존된다.

`docker cp`로 컨테이너에 복사한 파일은 이미지 레이어에 포함되지 않는다. 컨테이너가 제거되면 변경 사항이 사라지므로, 영구적인 변경은 반드시 Dockerfile에 반영하고 이미지를 재빌드해야 한다. 운영 컨테이너를 `docker cp`로 직접 수정하는 것은 디버깅 목적에 한정하는 것이 바람직하다.

---

**지난 글:** [docker port — 포트 매핑 확인](/posts/docker-port/)

**다음 글:** [docker pause / unpause — 컨테이너 일시 정지](/posts/docker-pause-unpause/)

<br>
읽어주셔서 감사합니다. 😊
