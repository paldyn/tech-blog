---
title: "docker logs — 컨테이너 로그 조회 완전 정복"
description: "docker logs의 -f/--tail/--since/--until/-t 옵션, stderr 분리, 로깅 드라이버 종류, 로그 로테이션 설정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker logs", "로깅 드라이버", "json-file", "로그 조회"]
featured: false
draft: false
---

[지난 글](/posts/docker-attach-vs-exec/)에서 컨테이너에 연결하는 두 방법을 비교했습니다. 이번에는 컨테이너가 출력한 로그를 조회하는 `docker logs` 명령과 로깅 드라이버를 살펴봅니다.

## docker logs 기본 사용법

```bash
docker logs web             # 지금까지 출력된 전체 로그
docker logs -f web          # 실시간 팔로우 (Ctrl+C로 중단)
docker logs --tail 50 web   # 마지막 50줄
```

`docker logs`는 컨테이너의 **stdout/stderr**를 조회합니다. 컨테이너가 중지된 후에도 로그는 남아 있습니다(`--rm` 없이 삭제하지 않은 경우).

## 주요 옵션

![docker logs 주요 옵션](/assets/posts/docker-logs-options.svg)

### -f (Follow)

```bash
docker logs -f --tail 100 web   # 최근 100줄부터 실시간 추적
```

`tail -f`와 같은 동작입니다. `-f`만 쓰면 전체 로그를 출력한 뒤 새 로그를 이어서 보여줍니다. `--tail 0`을 함께 쓰면 이전 로그 없이 새 로그만 추적합니다.

### --since / --until

```bash
# 최근 30분의 로그
docker logs --since 30m web

# 특정 시간 범위
docker logs --since 2026-05-10T00:00:00 --until 2026-05-10T01:00:00 web

# 유닉스 타임스탬프도 가능
docker logs --since 1746748800 web
```

상대 시간은 `s`(초), `m`(분), `h`(시간) 단위를 지원합니다.

### -t (Timestamps)

```bash
docker logs -t web
# 2026-05-10T00:12:34.567890123Z GET / 200
```

각 로그 줄 앞에 RFC3339 형식의 UTC 타임스탬프를 추가합니다. 장애 발생 시점 특정에 유용합니다.

## stderr 분리

컨테이너의 stdout과 stderr는 기본적으로 섞여 출력됩니다.

```bash
# stderr만 보기
docker logs web 2>&1 1>/dev/null

# stdout만 보기
docker logs web 2>/dev/null

# 에러 라인만 grep
docker logs web 2>&1 | grep -i error
```

## 로깅 드라이버

![Docker 로깅 드라이버](/assets/posts/docker-logs-drivers.svg)

기본 드라이버는 `json-file`입니다. 로그를 호스트 파일시스템(`/var/lib/docker/containers/<id>/<id>-json.log`)에 JSON 형식으로 저장합니다.

### 로그 파일 크기 제한

기본값은 무제한이므로 장기 운영 컨테이너는 반드시 로테이션을 설정합니다.

```bash
# docker run 시 지정
docker run \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  nginx:alpine
```

`daemon.json`에서 전체 기본값을 변경할 수도 있습니다.

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 현재 드라이버 확인

```bash
docker inspect web --format '{{.HostConfig.LogConfig.Type}}'
```

## 실무 패턴

```bash
# 장애 직후 로그 추출 (타임스탬프 포함 + 에러 필터)
docker logs -t --since 1h web 2>&1 | grep -E "ERROR|WARN|panic"

# 로그를 파일로 저장
docker logs web > web.log 2>&1

# 여러 컨테이너 로그 동시 팔로우 (별도 터미널 또는 tmux)
docker logs -f web &
docker logs -f db &
```

## 정리

`docker logs -f --tail N`은 컨테이너 트러블슈팅의 첫 번째 도구입니다. `--since`로 시간 범위를 좁히고, `-t`로 타임스탬프를 붙이면 장애 원인을 빠르게 파악할 수 있습니다. 장기 운영 환경에서는 반드시 로그 로테이션을 설정하세요.

---

**지난 글:** [docker attach vs exec — 차이점과 올바른 활용법](/posts/docker-attach-vs-exec/)

**다음 글:** [docker inspect — 컨테이너·이미지 상세 정보 조회](/posts/docker-inspect/)

<br>
읽어주셔서 감사합니다. 😊
