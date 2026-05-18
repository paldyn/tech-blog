---
title: "Docker Compose up/down: 서비스 생명주기 완전 정복"
description: "compose up의 --build·--force-recreate·--wait·--scale 옵션, compose down의 -v·--rmi·--remove-orphans 동작, 실전 명령 패턴을 상세히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "up", "down", "서비스생명주기", "컨테이너관리"]
featured: false
draft: false
---

[지난 글](/posts/compose-watch/)에서 watch로 핫 리로드 개발 환경을 구성했다. 이번에는 Compose 서비스를 시작하고 종료하는 `up`·`down` 명령의 동작 방식과 주요 옵션을 정리한다.

## compose up 동작 순서

`docker compose up`은 다음 순서로 인프라를 구성한다.

1. 네트워크 생성 (없으면)
2. 볼륨 생성 (없으면)
3. 이미지 pull 또는 build
4. `depends_on` 순서에 따라 컨테이너 생성 및 시작

컨테이너가 이미 존재하고 설정이 바뀌지 않았으면 재사용한다. 설정이 바뀌었으면 컨테이너를 교체한다.

```bash
docker compose up           # 포그라운드 실행 (Ctrl+C로 종료)
docker compose up -d        # 백그라운드 실행 (detach)
docker compose up -d --build  # 이미지 강제 재빌드 후 시작
```

## 주요 up 옵션

**`--build`** — 이미지가 이미 있어도 무조건 재빌드한다. 소스 변경 후 이미지를 갱신하고 싶을 때 쓴다.

**`--force-recreate`** — 설정이 바뀌지 않았어도 컨테이너를 삭제하고 새로 만든다.

**`--no-recreate`** — 반대로, 설정이 바뀌어도 기존 컨테이너를 유지한다.

**`--wait`** — healthcheck가 있는 서비스는 healthy 상태가 될 때까지 명령이 블록된다. CI에서 서비스 준비 완료를 기다릴 때 유용하다.

```bash
docker compose up -d --wait
echo "모든 서비스 준비 완료"
```

**`--scale`** — 특정 서비스를 여러 컨테이너로 확장한다.

```bash
docker compose up -d --scale worker=3
```

**`--no-deps`** — 의존 서비스를 무시하고 지정한 서비스만 시작한다.

```bash
docker compose up -d api --no-deps  # api만 (db 시작 안 함)
```

**`--remove-orphans`** — compose.yaml에서 제거된 서비스의 컨테이너를 정리한다.

![up/down 생명주기 다이어그램](/assets/posts/compose-up-down-diagram.svg)

## compose down 동작

`compose down`은 컨테이너를 `SIGTERM`으로 종료하고, 기본 10초 후에도 살아있으면 `SIGKILL`로 강제 종료한다. 이후 컨테이너와 프로젝트 네트워크를 삭제한다.

```bash
docker compose down
```

볼륨은 기본적으로 **삭제하지 않는다**. DB 데이터를 유지하기 위한 의도적 설계다.

## 주요 down 옵션

**`-v` / `--volumes`** — named volume도 함께 삭제한다. DB 데이터가 완전히 사라지므로 주의가 필요하다. `external: true`로 선언된 외부 볼륨은 제외된다.

```bash
docker compose down -v  # 볼륨 포함 삭제
```

**`--rmi`** — 이미지도 삭제한다.

```bash
docker compose down --rmi all    # 모든 이미지 삭제
docker compose down --rmi local  # 태그 없는 이미지만 삭제
```

**`--remove-orphans`** — compose.yaml에 없는 컨테이너도 정리한다.

**`--timeout`** — SIGTERM 후 SIGKILL까지 대기 시간(초, 기본 10)을 조정한다.

```bash
docker compose down --timeout 30  # 30초 대기
```

![up/down 명령 코드 예시](/assets/posts/compose-up-down-code.svg)

## 완전 초기화 패턴

개발 중 모든 것을 깨끗하게 지우고 싶을 때 쓰는 패턴이다.

```bash
# 모든 것 삭제 (컨테이너 + 볼륨 + 이미지)
docker compose down -v --rmi all --remove-orphans

# 다시 빌드해서 시작
docker compose up -d --build
```

## stop / start vs down / up

`stop`·`start`는 컨테이너를 보존하면서 프로세스만 멈추고 재개한다. `down`·`up`은 컨테이너 자체를 삭제하고 다시 만든다.

```bash
docker compose stop    # 컨테이너 정지 (삭제 안 함)
docker compose start   # 기존 컨테이너 재시작
docker compose restart # 정지 후 재시작 (롤링 아님)
```

설정 변경 없이 일시적으로 서비스를 멈추려면 `stop/start`가 빠르다. 설정이 바뀌었거나 완전히 새로 시작하려면 `down/up`을 쓴다.

## up 이후 자주 쓰는 명령

```bash
docker compose ps         # 서비스 상태 확인
docker compose logs -f    # 로그 스트리밍
docker compose exec web sh  # 실행 중 컨테이너에 접속
docker compose top        # 컨테이너별 프로세스
```

---

**지난 글:** [Docker Compose watch: 소스 변경 자동 감지 핫 리로드](/posts/compose-watch/)

**다음 글:** [Docker Compose logs/ps: 서비스 상태 조회와 로그 분석](/posts/compose-logs-ps/)

<br>
읽어주셔서 감사합니다. 😊
