---
title: "docker events — 실시간 이벤트 스트림 모니터링"
description: "docker events 명령으로 Docker 데몬이 발생시키는 컨테이너·이미지·네트워크·볼륨 이벤트를 실시간으로 수신하고, 필터·포맷·시간 범위 옵션을 활용해 운영 모니터링과 자동화를 구현하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "events", "monitoring", "automation"]
featured: false
draft: false
---

[지난 글](/posts/docker-top/)에서 `docker top`으로 컨테이너 내부 프로세스를 호스트 관점에서 들여다봤다면, 이번에는 Docker 데몬이 생성하는 **이벤트 스트림**으로 시선을 넓혀보자. `docker events`는 데몬이 내부적으로 발생시키는 모든 사건을 실시간으로 구독할 수 있는 명령으로, 장애 감지·자동화·CI 훅 구현의 핵심 도구다.

## Docker 이벤트란?

Docker 데몬은 컨테이너의 생명주기, 이미지 조작, 네트워크·볼륨 변경 등 모든 주요 동작에 대해 **이벤트**를 발생시킨다. 이벤트는 Unix 소켓 또는 TCP를 통해 클라이언트에 스트리밍되며, `docker events` 명령을 실행하면 터미널이 블로킹 상태로 대기하면서 이벤트를 출력한다.

![Docker Events 스트림 구조](/assets/posts/docker-events-stream-architecture.svg)

이벤트는 크게 네 가지 타입으로 분류된다.

| 타입 | 주요 이벤트 |
|------|-----------|
| `container` | create, start, stop, kill, die, restart, pause, unpause, exec_start, attach, copy, rename, rm |
| `image` | pull, push, tag, untag, delete, prune, load, save |
| `network` | create, connect, disconnect, destroy |
| `volume` | create, mount, unmount, destroy |

## 기본 사용법

아무 옵션 없이 실행하면 이후 발생하는 이벤트를 무한 대기하며 출력한다.

```bash
docker events
```

다른 터미널에서 `docker run hello-world`를 실행하면 아래와 같은 출력이 흐른다.

```
2026-05-11T10:00:01.123456789+09:00 container create ...
2026-05-11T10:00:01.234567890+09:00 container start ...
2026-05-11T10:00:02.345678901+09:00 container die ...
```

`--since`와 `--until` 옵션으로 과거 이벤트를 조회하거나 범위를 지정할 수 있다.

```bash
# 최근 1시간 이벤트만 조회하고 종료
docker events --since 1h --until now

# 특정 타임스탬프 기준 조회
docker events --since "2026-05-11T09:00:00"
```

`--until`에 과거 시간을 지정하면 해당 시점까지의 이벤트를 출력하고 자동 종료된다. 현재 시각보다 미래 시간을 지정하면 그 시각까지 대기한다.

## 필터 옵션

대규모 환경에서는 이벤트 양이 방대하다. `--filter` 옵션으로 원하는 이벤트만 걸러낼 수 있다.

```bash
# container 타입 이벤트만
docker events --filter 'type=container'

# die 이벤트만
docker events --filter 'event=die'

# 특정 컨테이너의 start/stop만
docker events \
  --filter 'container=web-server' \
  --filter 'event=start' \
  --filter 'event=stop'
```

필터는 같은 key에 여러 값을 지정하면 **OR** 조건, 다른 key를 조합하면 **AND** 조건으로 동작한다. 위 예시는 `web-server` 컨테이너의 start 또는 stop 이벤트를 수신한다.

라벨 기반 필터링도 가능하다.

```bash
docker events --filter 'label=env=production'
```

## 출력 포맷 커스터마이징

기본 출력은 사람이 읽기 좋은 형태지만, 파이프라인 처리를 위해 Go 템플릿으로 포맷을 바꿀 수 있다.

```bash
# 타임스탬프·타입·액션만 추출
docker events --format '{{.Time}} {{.Type}} {{.Action}}'

# JSON 출력 → jq로 처리
docker events --format '{{json .}}' | jq .

# 컨테이너 이름만 출력
docker events \
  --filter 'type=container' \
  --format '{{.Actor.Attributes.name}} {{.Action}}'
```

`{{json .}}`은 전체 이벤트 객체를 JSON으로 직렬화한다. jq와 조합하면 특정 필드 추출이나 조건 필터링이 쉬워진다.

![docker events 명령 패턴](/assets/posts/docker-events-commands.svg)

## 자동화 패턴

`docker events`의 진가는 스크립트와 결합할 때 드러난다.

**컨테이너 종료 시 알림:**

```bash
docker events \
  --filter 'event=die' \
  --format '{{.Actor.Attributes.name}}' \
  | while read name; do
      echo "컨테이너 '$name' 종료됨 — 확인 필요"
      # curl -X POST $SLACK_WEBHOOK -d "{\"text\":\"$name died\"}"
    done
```

**특정 이미지 pull 완료 감지:**

```bash
docker events \
  --filter 'type=image' \
  --filter 'event=pull' \
  --format '{{.Actor.Attributes.name}}' \
  | while read img; do
      echo "이미지 업데이트: $img"
      docker compose up -d
    done
```

이 패턴은 레지스트리 웹훅 없이도 이미지 갱신에 반응하는 단순한 자동 배포를 구현할 수 있다.

## 실전 팁

`docker events`를 백그라운드로 실행해 감사 로그를 남길 수 있다.

```bash
docker events \
  --format '{{json .}}' \
  >> /var/log/docker-events.jsonl &
```

`kill -0 $!`로 프로세스 생존 여부를 주기적으로 확인하거나, systemd 서비스로 등록해 재시작을 보장하는 것이 안정적이다.

이벤트 스트림은 **블로킹 연결**이므로 네트워크 단절이나 데몬 재시작 시 끊어진다. 프로덕션 환경에서는 자동 재연결 로직을 반드시 추가해야 한다.

---

**지난 글:** [docker top — 컨테이너 내부 프로세스 확인](/posts/docker-top/)

**다음 글:** [docker port — 포트 매핑 확인](/posts/docker-port/)

<br>
읽어주셔서 감사합니다. 😊
