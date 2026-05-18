---
title: "Docker Compose watch: 소스 변경 자동 감지 핫 리로드"
description: "compose watch의 sync·rebuild·sync+restart 세 가지 action, develop.watch 블록 설정법, Node.js·Python 핫 리로드 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "watch", "핫리로드", "개발환경", "sync"]
featured: false
draft: false
---

[지난 글](/posts/compose-override/)에서 override 파일로 개발 환경을 분리하는 방법을 살펴봤다. 이번에는 Compose v2.22에서 GA된 `watch` 기능으로 소스 파일 변경을 자동으로 감지해 컨테이너에 반영하는 방법을 정리한다.

## compose watch가 해결하는 문제

볼륨 바인드 마운트(`. :/app`)는 컨테이너와 호스트 파일시스템을 공유하는 가장 단순한 방법이지만, 노드 모듈처럼 컨테이너 안에서만 필요한 디렉터리를 덮어쓰거나 성능 문제(macOS)가 있다. `watch`는 **어떤 파일이 바뀌면 어떤 동작을 할지** 선언적으로 제어한다.

```yaml
services:
  web:
    build: .
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package.json
```

## action 타입 세 가지

**sync** — 파일을 컨테이너 `target` 경로로 즉시 복사한다. 컨테이너가 재시작되지 않는다. 앱 내부의 핫 리로더(nodemon, uvicorn `--reload`)가 변경을 감지해서 처리한다.

**rebuild** — 이미지를 재빌드하고 컨테이너를 교체한다. `Dockerfile` 변경이나 의존성 파일(`package.json`, `requirements.txt`, `go.sum`) 변경 시 쓴다. 시간이 걸리지만 완전히 새 환경으로 시작한다.

**sync+restart** — 파일을 sync한 뒤 컨테이너만 재시작한다. 이미지 재빌드 없이 빠르게 설정 파일 변경을 반영할 때 쓴다.

![compose watch 동작 다이어그램](/assets/posts/compose-watch-diagram.svg)

## 언제 어떤 action을 쓰나

| 변경 파일 | 권장 action |
|-----------|-------------|
| 소스 코드 (핫리로더 있음) | sync |
| Dockerfile, .dockerignore | rebuild |
| package.json, requirements.txt | rebuild |
| nginx.conf, app.yaml 등 설정 | sync+restart |
| 정적 파일 (CSS, 이미지) | sync |

## Node.js와 Python 예시

```yaml
services:
  # Node.js — nodemon으로 핫 리로드
  web:
    build: .
    command: npx nodemon src/index.js
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package.json

  # Python — uvicorn --reload
  api:
    build: .
    command: uvicorn app.main:app --reload --host 0.0.0.0
    develop:
      watch:
        - action: sync
          path: ./app
          target: /app
          ignore:
            - __pycache__
            - "*.pyc"
        - action: rebuild
          path: requirements.txt
```

![compose watch 코드 예시](/assets/posts/compose-watch-code.svg)

## watch 실행 방법

```bash
# watch 모드로 시작
docker compose up --watch

# 이미 실행 중일 때 watch 시작
docker compose watch

# 특정 서비스만
docker compose watch web api
```

## ignore 패턴

`path` 아래에서 감시할 때 제외할 패턴을 `ignore`로 지정한다. glob 형식이다.

```yaml
- action: sync
  path: .
  target: /app
  ignore:
    - node_modules/
    - "*.test.ts"
    - dist/
    - .git/
```

node_modules, .git, __pycache__ 같은 공통 패턴은 자동으로 제외된다.

## 볼륨 마운트 vs watch 비교

| 기준 | bind mount | compose watch |
|------|-----------|---------------|
| 선언 | volumes: .:/app | develop.watch |
| 세밀한 제어 | 어려움 | 파일별 action 지정 |
| node_modules 충돌 | anonymous volume으로 해결 | 자연스럽게 분리 |
| macOS 성능 | 느림 (옵션으로 개선 가능) | sync만 하므로 빠름 |
| 멀티 action | 불가 | sync+rebuild 조합 가능 |

소규모 프로젝트에서는 bind mount가 간단하고 충분하다. 더 정교한 제어가 필요하거나 macOS에서 성능 문제가 있을 때 watch로 전환한다.

---

**지난 글:** [Docker Compose override: 환경별 설정 재정의 패턴](/posts/compose-override/)

**다음 글:** [Docker Compose up/down: 서비스 생명주기 완전 정복](/posts/compose-up-down/)

<br>
읽어주셔서 감사합니다. 😊
