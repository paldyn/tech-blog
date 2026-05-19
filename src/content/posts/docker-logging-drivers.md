---
title: "Docker 로깅 드라이버: 로그 수집·전달 완전 정복"
description: "json-file·local·syslog·fluentd·gelf 드라이버 특징, docker logs 사용 가능 여부, max-size/max-file 로테이션, 전역 및 컨테이너별 설정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "logging", "로깅드라이버", "json-file", "fluentd", "syslog", "log-rotation"]
featured: false
draft: false
---

[지난 글](/posts/docker-zombie-process/)에서 좀비 프로세스 방지를 다뤘다. 이번에는 컨테이너가 출력하는 로그가 어디로, 어떻게 전달되는지를 제어하는 **로그 드라이버**를 정리한다.

## 로그 드라이버 동작 원리

컨테이너 프로세스가 `stdout`과 `stderr`에 출력하면, Docker daemon이 이를 가로채 설정된 **로그 드라이버**를 통해 목적지로 전달한다. 목적지는 드라이버에 따라 로컬 파일, OS 로그 시스템, 중앙 로그 수집기 등 다양하다.

![로깅 드라이버 구조](/assets/posts/docker-logging-drivers-overview.svg)

## 주요 드라이버

**json-file** — 기본 드라이버다. 컨테이너 로그를 JSON 형식으로 호스트 파일 시스템(`/var/lib/docker/containers/<id>/<id>-json.log`)에 저장한다. `docker logs` 명령이 이 파일을 읽는다.

**local** — json-file보다 효율적인 바이너리 형식으로 저장한다. 같은 내용에서 디스크 사용량이 더 적다. `docker logs`도 지원한다. json-file의 좋은 대안이다.

**none** — 로그를 완전히 버린다. `docker logs`가 작동하지 않는다. 로그가 불필요한 일회성 컨테이너나 성능이 최우선인 경우에 쓴다.

**syslog** — 호스트의 syslog 데몬(rsyslog, syslog-ng)으로 로그를 전송한다. `docker logs`가 작동하지 않는다.

**journald** — systemd journald로 전송한다. `journalctl -u docker` 또는 container 이름으로 조회한다. `docker logs`도 가능하다.

**fluentd** — Fluentd 또는 Fluent Bit 인스턴스로 전송한다. Elasticsearch-Fluentd-Kibana(EFK) 스택의 핵심 컴포넌트다. `docker logs`가 작동하지 않는다.

**gelf** — GELF(Graylog Extended Log Format)로 Graylog나 Logstash에 UDP/TCP로 전송한다.

**awslogs** — Amazon CloudWatch Logs로 직접 전송한다.

**splunk** — Splunk HTTP Event Collector로 전송한다.

## 전역 기본값 설정

모든 컨테이너에 같은 드라이버를 적용하려면 `/etc/docker/daemon.json`을 수정한다.

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": "true"
  }
}
```

`max-size`와 `max-file`로 로그 로테이션을 설정한다. `10m × 3 = 30MB` 이상의 로그는 오래된 것부터 삭제된다. 이 설정이 없으면 로그 파일이 무한히 커질 수 있다.

변경 후 `sudo systemctl reload docker`로 적용한다.

## 컨테이너별 설정

```bash
docker run -d \
  --log-driver json-file \
  --log-opt max-size=50m \
  --log-opt max-file=5 \
  nginx
```

`--log-driver none`으로 특정 컨테이너의 로그를 비활성화할 수 있다.

![로그 드라이버 설정 방법](/assets/posts/docker-logging-drivers-config.svg)

## Compose에서 설정

```yaml
services:
  app:
    image: myapp
    logging:
      driver: json-file
      options:
        max-size: "20m"
        max-file: "5"

  worker:
    image: worker
    logging:
      driver: fluentd
      options:
        fluentd-address: "localhost:24224"
        tag: "worker.{{.Name}}"
```

## fluentd 드라이버 연동

Fluent Bit를 사이드카로 실행하거나 호스트에서 실행하고 Docker 로그 드라이버로 수집하는 패턴이다.

```yaml
services:
  fluent-bit:
    image: fluent/fluent-bit:latest
    ports:
      - "24224:24224"
    volumes:
      - ./fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf

  app:
    image: myapp
    logging:
      driver: fluentd
      options:
        fluentd-address: "127.0.0.1:24224"
        fluentd-async: "true"   # 연결 실패 시 앱 차단 방지
        tag: "app"
```

`fluentd-async: true`는 Fluentd가 다운됐을 때 컨테이너가 블록되는 것을 방지한다. 단, 로그가 유실될 수 있다.

## docker logs 명령 정리

```bash
# 전체 로그
docker logs <container>

# 마지막 100줄
docker logs --tail 100 <container>

# 실시간 스트리밍
docker logs -f <container>

# 특정 시각 이후
docker logs --since 2026-05-20T00:00:00 <container>

# 타임스탬프 포함
docker logs -t <container>
```

`syslog`, `fluentd`, `gelf` 드라이버를 쓰면 `docker logs`가 동작하지 않는다. 해당 로그 수집 시스템에서 직접 조회해야 한다.

## 디스크 정리

json-file 드라이버 사용 중 디스크가 가득 찬 경우, 특정 컨테이너 로그 파일을 직접 비울 수 있다.

```bash
# 로그 파일 경로 확인
docker inspect --format='{{.LogPath}}' <container>

# 로그 내용 비우기 (파일 삭제 금지)
truncate -s 0 $(docker inspect --format='{{.LogPath}}' <container>)
```

파일을 삭제하면 Docker가 새 파일 경로를 인식하지 못하므로 반드시 `truncate`를 사용한다.

---

**지난 글:** [Docker 좀비 프로세스: 발생 원인과 방지 전략](/posts/docker-zombie-process/)

**다음 글:** [Docker 스토리지 드라이버: overlay2·devicemapper 완전 정복](/posts/docker-storage-drivers/)

<br>
읽어주셔서 감사합니다. 😊
