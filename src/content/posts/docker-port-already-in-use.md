---
title: "Docker Port Already in Use 에러 해결"
description: "docker: Error response from daemon: Ports are not available: bind: address already in use 에러의 원인을 찾고, 프로세스 종료·포트 변경·Compose 환경변수 패턴으로 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "port", "address-already-in-use", "lsof", "ss", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-conflict/)에서 네트워크 서브넷 충돌을 해결했다. 이번에는 비슷하지만 훨씬 자주 발생하는 **포트 충돌** 에러를 다룬다. `-p 8080:80`으로 컨테이너를 실행하려는데 포트가 이미 사용 중이라는 에러가 뜨는 상황이다.

## 에러 메시지

```
Error response from daemon: driver failed programming external
connectivity on endpoint mycontainer:
Bind for 0.0.0.0:8080 failed: port is already allocated.

또는

Error response from daemon: Ports are not available:
exposing port TCP 0.0.0.0:8080 -> 0.0.0.0:0:
listen tcp 0.0.0.0:8080: bind: address already in use
```

## 원인 찾기

![Port Already in Use 진단 흐름](/assets/posts/docker-port-already-in-use-flow.svg)

호스트의 8080 포트를 누가 쓰고 있는지 확인한다.

```bash
# Linux: ss 명령
ss -tlnp | grep :8080

# Linux: lsof 명령
sudo lsof -i :8080

# macOS
lsof -nP -iTCP:8080 -sTCP:LISTEN

# Windows PowerShell
netstat -ano | findstr :8080
# 출력된 PID로 프로세스 확인
tasklist /fi "PID eq <PID>"
```

출력 예시:

```
COMMAND   PID   USER   TYPE  DEVICE  NODE NAME
node     1234  alice  IPv4  12345   TCP  *:8080 (LISTEN)
```

Node.js 프로세스가 8080을 점유하고 있다. Docker가 점유하는 경우도 많다:

```bash
# 이미 실행 중인 Docker 컨테이너 포트 확인
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

정지된 컨테이너가 포트를 점유하는 경우는 없지만, **실행 중인** 컨테이너가 같은 포트를 쓰는 경우는 흔하다.

## 해결 방법

### 방법 1: 점유 프로세스 종료

```bash
# PID를 직접 찾아 종료
sudo kill $(sudo lsof -ti :8080)

# 또는
sudo ss -tlnp | grep :8080
# 출력에서 pid=숫자 확인 후
sudo kill -9 <PID>
```

서비스가 필요 없는 경우에 쓴다. 중요한 프로세스라면 방법 2나 3을 선택한다.

### 방법 2: 다른 호스트 포트 사용

```bash
# 8081로 변경
docker run -p 8081:80 nginx

# 컨테이너 내부 포트(80)는 그대로이므로 앱 코드 변경 없음
```

가장 간단하고 안전한 방법이다.

### 방법 3: 실행 중인 컨테이너 정지

```bash
# 해당 포트를 쓰는 컨테이너 찾기
docker ps --format "{{.Names}}: {{.Ports}}" | grep 8080

# 정지
docker stop <컨테이너명>

# 이후 새 컨테이너 실행
docker run -p 8080:80 nginx
```

같은 포트를 두 컨테이너가 동시에 쓸 수는 없다. 기존 컨테이너를 먼저 정지하거나 제거한다.

## Compose에서의 충돌 예방

![Compose 포트 충돌 방지 패턴](/assets/posts/docker-port-already-in-use-compose.svg)

### 환경변수로 포트를 분리

```yaml
# docker-compose.yml
services:
  web:
    image: nginx
    ports:
      - "${WEB_PORT:-8080}:80"

  db:
    image: postgres:16
    ports:
      - "${DB_PORT:-5432}:5432"
```

```bash
# .env (개발자별)
WEB_PORT=8081
DB_PORT=15432
```

팀원마다 다른 포트를 쓰면 같은 머신에서 여러 프로젝트를 동시에 실행해도 충돌하지 않는다.

### 호스트 포트 자동 할당

```yaml
services:
  web:
    image: nginx
    ports:
      - "80"  # 호스트 포트를 OS가 자동 할당
```

```bash
# 할당된 포트 확인
docker compose port web 80
# 0.0.0.0:49152

docker port myapp_web_1 80
# 0.0.0.0:49152
```

개발 환경에서 포트 번호를 신경 쓰지 않아도 될 때 유용하다.

## 자주 충돌하는 포트와 대안

| 서비스 | 기본 포트 | 충돌 시 대안 |
|---|---|---|
| HTTP | 80 | 8080, 8081 |
| MySQL | 3306 | 13306 |
| PostgreSQL | 5432 | 15432 |
| Redis | 6379 | 16379 |
| MongoDB | 27017 | 37017 |
| Elasticsearch | 9200 | 19200 |

팀 내에서 규칙을 정해두면(예: 로컬 DB 포트는 원본+10000) 충돌을 줄일 수 있다.

---

**지난 글:** [Docker 네트워크 서브넷 충돌 해결](/posts/docker-network-conflict/)

**다음 글:** [Docker 볼륨 마운트 권한 문제 해결](/posts/docker-mount-permission-issue/)

<br>
읽어주셔서 감사합니다. 😊
