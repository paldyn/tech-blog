---
title: "docker ps — 실행 중인 컨테이너 조회 완전 정복"
description: "docker ps 명령의 출력 컬럼 해석, -a/-q/-f/--format 옵션, 필터링 조건, 그리고 스크립트에서 활용하는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker ps", "컨테이너 목록", "CLI", "필터링"]
featured: false
draft: false
---

[지난 글](/posts/docker-run-basics/)에서 `docker run`으로 컨테이너를 실행하는 법을 배웠다면, 이번에는 실행 중인 컨테이너 목록을 확인하고 원하는 항목만 추려내는 `docker ps` 명령을 살펴봅니다.

## 기본 사용법

```bash
docker ps          # 실행 중인 컨테이너만 표시
docker ps -a       # 종료된 컨테이너까지 모두 표시
```

기본 상태에서는 STATUS가 `Up`인 컨테이너만 보입니다. 종료 후 삭제되지 않은 컨테이너를 확인하려면 `-a (--all)` 플래그가 필수입니다.

## 출력 컬럼 이해

![docker ps 출력 컬럼 해부](/assets/posts/docker-ps-output.svg)

| 컬럼 | 내용 |
|------|------|
| CONTAINER ID | SHA-256 해시 앞 12자리 (전체 표시: `--no-trunc`) |
| IMAGE | 기반 이미지와 태그 |
| COMMAND | 컨테이너 내부에서 실행 중인 진입점 명령 |
| CREATED | 컨테이너가 생성된 시점 (상대 시간) |
| STATUS | 현재 상태: `Up`, `Exited (N)`, `Paused`, `Restarting` |
| PORTS | 노출된 포트 매핑 (`0.0.0.0:80->80/tcp` 형식) |
| NAMES | 지정 또는 자동 생성된 이름 |

STATUS의 `Exited (N)` 에서 N은 컨테이너 종료 코드입니다. `0`이면 정상 종료, `1` 이상이면 오류 종료입니다.

## 주요 옵션

### -q (Quiet)

```bash
docker ps -q          # 실행 중인 컨테이너 ID만 출력
docker ps -aq         # 모든 컨테이너 ID만 출력
```

ID만 반환하므로 `xargs`와 조합해 일괄 작업에 유용합니다.

```bash
# 모든 컨테이너 일괄 삭제 (주의: 실행 중인 것도 강제 삭제)
docker rm -f $(docker ps -aq)
```

### -f (Filter)

![docker ps 필터링과 포맷](/assets/posts/docker-ps-filter.svg)

```bash
# 상태로 필터링
docker ps -f status=exited

# 이름 부분 일치
docker ps -f name=web

# 기반 이미지로 필터링
docker ps -f ancestor=nginx:alpine

# 복수 조건 (AND)
docker ps -f status=running -f name=app
```

필터 키는 `status`, `name`, `id`, `label`, `ancestor`, `exited`, `network`, `publish` 등을 지원합니다.

### --format

Go 템플릿 문법으로 출력 컬럼을 커스터마이징합니다.

```bash
# 이름과 상태만 탭 구분으로 출력
docker ps --format '{{.Names}}\t{{.Status}}'

# JSON Lines 형식 출력 (jq로 파싱 가능)
docker ps --format '{{json .}}'

# 표 형식 헤더 포함 출력
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

자주 쓰는 포맷은 `~/.docker/config.json`의 `psFormat` 키에 등록하면 기본값으로 사용됩니다.

```json
{
  "psFormat": "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"
}
```

## 컨테이너 수 빠르게 세기

```bash
# 실행 중인 컨테이너 수
docker ps -q | wc -l

# 종료된 컨테이너 수
docker ps -aq -f status=exited | wc -l
```

## 정리

`docker ps`는 단순해 보이지만 `-a`, `-q`, `-f`, `--format` 조합으로 강력한 조회 도구가 됩니다. 스크립트에서 특정 컨테이너 ID를 추출하거나, CI 환경에서 컨테이너 상태를 체크할 때 이 옵션들이 핵심 역할을 합니다.

---

**지난 글:** [docker run 기초 — 컨테이너 실행의 시작](/posts/docker-run-basics/)

**다음 글:** [컨테이너 중지·시작·재시작 — stop, start, restart 명령](/posts/docker-stop-start-restart/)

<br>
읽어주셔서 감사합니다. 😊
