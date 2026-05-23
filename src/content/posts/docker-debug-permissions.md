---
title: "컨테이너 권한 오류 디버깅: Permission denied 완벽 해결"
description: "컨테이너에서 발생하는 Permission denied 오류의 원인을 Linux 권한 모델부터 이해하고, UID 불일치·볼륨 소유권·USER 지시어 문제를 체계적으로 진단·수정하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "permission", "uid", "user", "volume", "chown", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/docker-tcpdump-in-container/)에서 tcpdump로 컨테이너 네트워크 패킷을 분석하는 방법을 살펴봤다. 디버깅 시리즈의 이번 편은 컨테이너에서 가장 자주 마주치는 오류 중 하나인 `Permission denied`를 다룬다. 원인을 모르면 `--user root`로 임시 해결하고 넘어가기 쉬운데, 이렇게 하면 보안 구멍을 만드는 것이다.

## Linux 권한 모델이 그대로 적용된다

![컨테이너 권한 확인 흐름](/assets/posts/docker-debug-permissions-flow.svg)

컨테이너는 별도 OS가 아니라 호스트 커널 위에서 네임스페이스로 격리된 프로세스다. 파일 권한 확인은 Linux 커널이 처리하며, 순서는 다음과 같다.

1. 프로세스 UID/GID 결정 — Dockerfile `USER` 또는 `docker run --user` 로 지정
2. 파일 소유자(owner) 확인 — 소유자와 UID가 일치하면 owner 권한 적용
3. 권한 비트(r/w/x) 확인 — 부족하면 `EACCES(Permission denied)` 반환

```bash
# 실행 중인 컨테이너의 UID 확인
docker exec myapp id
# uid=1000(node) gid=1000(node) groups=1000(node)

# 파일 소유자와 권한 확인
docker exec myapp ls -la /app
# drwxr-xr-x 2 root root 4096 ...  ← 소유자 root, node 사용자는 읽기/실행만 가능

# 소유자 UID 숫자로 확인 (이름 매핑 없이)
docker exec myapp stat -c "%u %g %n" /app/config.json
```

## 가장 흔한 원인: UID 불일치

Dockerfile에서 `USER node`를 지정하면 UID 1000으로 실행된다. 그런데 `COPY` 또는 `ADD`로 복사한 파일은 기본적으로 root 소유다. 이 경우 쓰기 시도 시 `Permission denied`가 발생한다.

```bash
# NG: 파일은 root 소유인데 node로 실행
FROM node:20-alpine
WORKDIR /app
COPY . .          # 소유자: root:root
USER node
RUN npm run build  # node(uid=1000)가 root 파일에 쓰기 → 실패

# OK: COPY 시점에 소유권 지정
FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node . .   # 소유자: node:node로 복사
USER node
RUN npm run build  # 성공
```

## 볼륨 마운트가 소유권을 덮어쓴다

![권한 오류 수정 패턴](/assets/posts/docker-debug-permissions-fix.svg)

볼륨을 마운트할 때 호스트 디렉터리나 Named Volume의 소유자가 컨테이너 UID와 다르면 오류가 발생한다.

```bash
# 호스트 디렉터리 마운트 — 호스트의 UID/GID 그대로 전달됨
docker run -v $(pwd)/data:/app/data myapp
# 만약 $(pwd)/data 가 root 소유라면 컨테이너의 non-root 사용자는 쓰기 불가

# Named Volume — 처음 생성 시 root 소유
docker volume create mydata
docker run -v mydata:/data myapp
# /data 는 root:root로 생성 → non-root 컨테이너에서 쓰기 실패
```

### 수정 방법 1: 호스트 UID와 맞추기

```bash
# 호스트 사용자 UID와 동일하게 실행 (로컬 개발)
docker run \
  --user "$(id -u):$(id -g)" \
  -v "$(pwd)/data:/app/data" \
  myapp
```

### 수정 방법 2: 초기화 컨테이너로 소유권 설정

```bash
# Named Volume 소유권 초기화
docker run --rm \
  -v mydata:/data \
  alpine chown -R 1000:1000 /data

# 이후 실행
docker run \
  --user 1000:1000 \
  -v mydata:/data \
  myapp
```

### 수정 방법 3: entrypoint에서 동적 처리

```bash
# entrypoint.sh (root로 시작 후 gosu로 사용자 전환)
#!/bin/sh
set -e

# 볼륨 마운트된 디렉터리 소유권 수정
chown -R app:app /app/data 2>/dev/null || true

# non-root 사용자로 실제 명령 실행
exec gosu app "$@"
```

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache gosu
COPY --chown=root:root entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
```

## Docker Compose에서 UID 맞추기

```yaml
# compose.yml
services:
  app:
    image: myapp
    user: "${UID}:${GID}"  # 호스트 환경변수 사용
    volumes:
      - ./data:/app/data

# 실행 전 export
export UID=$(id -u)
export GID=$(id -g)
docker compose up
```

## 빠른 진단 체크리스트

```bash
# 1. 컨테이너 프로세스 UID 확인
docker exec myapp id

# 2. 문제 파일/디렉터리 소유자·권한 확인
docker exec myapp ls -la /path/to/problem

# 3. stat으로 숫자 UID 확인 (이름 불일치 방지)
docker exec myapp stat -c "%u %g" /path/to/problem

# 4. 호스트 볼륨 디렉터리 소유자 확인
ls -la ./data

# 5. 임시로 root 실행해서 문제 재현 여부 확인
docker exec --user root myapp ls -la /problem-path
```

`Permission denied` 메시지와 함께 위 체크리스트를 순서대로 실행하면 대부분의 경우 원인을 찾을 수 있다.

---

**지난 글:** [tcpdump로 컨테이너 네트워크 패킷 분석하기](/posts/docker-tcpdump-in-container/)

**다음 글:** [컨테이너 네트워크 연결 문제 디버깅](/posts/docker-debug-networking/)

<br>
읽어주셔서 감사합니다. 😊
