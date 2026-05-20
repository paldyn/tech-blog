---
title: "Docker 비루트 사용자: 컨테이너 권한 최소화"
description: "컨테이너를 루트가 아닌 사용자로 실행해야 하는 이유, Alpine·Debian 기반 비루트 사용자 생성 패턴, 파일 소유권 문제 해결, Kubernetes PodSecurity 연동까지 실전 가이드를 제공합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "non-root", "USER", "보안", "권한", "컨테이너"]
featured: false
draft: false
---

[지난 글](/posts/docker-security-overview/)에서 Docker 보안의 5개 레이어를 살펴봤다. 그 중 첫 번째 실천 항목인 **비루트 사용자(non-root user)**를 이번 글에서 깊이 다룬다. 단순히 Dockerfile에 `USER` 한 줄을 추가하는 것이지만, 파일 소유권과 실행 권한 문제를 제대로 이해하지 않으면 컨테이너가 시작조차 하지 않는 상황이 생긴다.

## 왜 비루트로 실행해야 하는가

Docker 컨테이너는 기본적으로 root(UID 0)로 실행된다. User Namespace가 활성화되지 않은 환경에서 컨테이너 내부의 UID 0은 **호스트의 UID 0과 동일한 식별자**를 공유한다. 컨테이너 격리가 뚫렸을 때 root 권한으로 호스트 파일 시스템에 접근하거나 커널 기능을 악용할 수 있다.

비루트 사용자로 실행하면 이 폭발 반경(blast radius)이 크게 줄어든다. 컨테이너가 침해되더라도 공격자는 그 UID의 권한 범위 안에 갇힌다.

![Root vs 비루트 사용자 권한 비교](/assets/posts/docker-non-root-user-privilege.svg)

## 사용자 생성 패턴

### Alpine Linux

```dockerfile
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --chown=app:app package*.json ./
RUN npm ci --only=production
COPY --chown=app:app . .
USER app
CMD ["node", "server.js"]
```

Alpine은 `addgroup`/`adduser`를 사용하며 `-S` 플래그가 시스템 사용자(no login shell, no home dir)를 의미한다.

### Debian/Ubuntu

```dockerfile
FROM python:3.12-slim
RUN groupadd -r app && useradd -r -g app -s /sbin/nologin app
WORKDIR /app
COPY --chown=app:app requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app . .
USER app
CMD ["python", "app.py"]
```

`-r` 플래그는 시스템 사용자를 만든다(UID < 1000, no password aging).

### 공식 이미지의 기본 제공 사용자

많은 공식 이미지는 이미 비루트 사용자를 포함한다.

```dockerfile
# node 이미지: 'node' 사용자 (UID 1000)
FROM node:20-alpine
USER node

# nginx 이미지: 'nginx' 사용자
FROM nginx:alpine
# nginx는 master process만 root로 기동, worker는 자동으로 nginx 사용자

# postgres 이미지: 'postgres' 사용자 (UID 999)
FROM postgres:16-alpine
USER postgres
```

## --chown 플래그의 중요성

`COPY` 명령어는 기본적으로 파일을 root 소유로 복사한다. `USER app`으로 전환한 후에는 이 파일들을 읽기만 할 수 있고 쓸 수 없다.

```dockerfile
# 잘못된 예: root 소유로 복사 후 USER 전환
COPY . .
USER app
# → app이 파일에 쓰려 하면 Permission denied

# 올바른 예: 복사 시점에 소유권 지정
COPY --chown=app:app . .
USER app
```

이미 빌드된 이미지에서 소유권을 바꾸고 싶다면 `RUN chown -R app:app /app`을 사용하지만, 이 방법은 레이어를 하나 더 추가한다.

## 볼륨 마운트와 소유권 충돌

볼륨을 마운트하면 호스트 디렉터리의 소유권이 컨테이너 내부에 그대로 반영된다.

```bash
# 호스트에서 root:root 소유인 디렉터리를 마운트
docker run -v /host/data:/app/data --user 1000:1000 myimage
# → 컨테이너 내부 app(1000)이 /app/data에 쓸 수 없음

# 해결: 호스트 디렉터리 소유권을 맞추거나
sudo chown -R 1000:1000 /host/data

# 또는 named volume 사용 (Docker가 소유권 관리)
docker run -v mydata:/app/data --user 1000:1000 myimage
```

Named volume은 컨테이너 최초 실행 시 Dockerfile의 VOLUME 선언 기준으로 초기화되므로 소유권 문제가 없다.

## 런타임 오버라이드

Dockerfile에 `USER`가 없어도 `docker run --user`로 덮어쓸 수 있다.

```bash
# UID:GID 직접 지정
docker run --user 1000:1000 myimage

# 호스트 현재 사용자의 UID/GID 전달 (개발 환경에서 유용)
docker run --user "$(id -u):$(id -g)" myimage

# 현재 컨테이너 내 사용자 확인
docker exec mycontainer id
# uid=1000(app) gid=1000(app) groups=1000(app)
```

![비루트 사용자 설정 패턴](/assets/posts/docker-non-root-user-setup.svg)

## 자주 발생하는 오류

### Permission denied: /tmp

`/tmp`는 sticky bit가 설정된 디렉터리지만 앱이 직접 쓰는 경우 권한 문제가 생길 수 있다.

```dockerfile
# /tmp를 앱 사용자가 쓸 수 있도록 명시적으로 권한 부여
RUN mkdir -p /tmp/app && chown -R app:app /tmp/app
USER app
```

또는 `--tmpfs /tmp`로 메모리 마운트를 사용한다.

### 1000번 이하 포트 바인딩

리눅스에서 1024 미만 포트를 열려면 `CAP_NET_BIND_SERVICE` capability가 필요하다. 비루트 사용자는 이 capability를 기본적으로 갖지 않는다.

```dockerfile
# 잘못된 예: 비루트에서 80 포트 열기 시도
EXPOSE 80
USER app
# → bind: permission denied

# 올바른 예 1: 1024 이상 포트 사용
EXPOSE 8080
USER app

# 올바른 예 2: capability 추가
# docker run --cap-add=NET_BIND_SERVICE --user app myimage
```

프로덕션에서는 앱을 8080 등 고번호 포트로 실행하고 로드밸런서에서 80/443을 처리하게 하는 것이 일반적이다.

### pip install / npm install 권한 오류

패키지 설치는 root 권한으로 해야 한다. `USER` 지시어는 패키지 설치 이후에 배치한다.

```dockerfile
FROM python:3.12-slim
RUN groupadd -r app && useradd -r -g app app
WORKDIR /app
# root로 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# 설치 완료 후 사용자 전환
COPY --chown=app:app . .
USER app
CMD ["python", "app.py"]
```

## Compose에서 사용자 지정

```yaml
services:
  web:
    image: myimage
    user: "1000:1000"          # Dockerfile USER 오버라이드
    # 또는 환경변수로 동적 지정
    # user: "${UID}:${GID}"
```

## Kubernetes PodSecurity 연동

Kubernetes의 PodSecurity Admission은 `Restricted` 레벨에서 비루트 실행을 강제한다.

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
```

Dockerfile에 `USER`를 명시하면 `runAsNonRoot: true` 검사를 자동으로 통과한다.

## 비루트 사용자 체크리스트

- `USER` 지시어를 패키지 설치 이후, CMD 이전에 배치했는가?
- `COPY --chown` 또는 `RUN chown`으로 파일 소유권을 맞췄는가?
- 앱이 바인딩하는 포트가 1024 이상인가?
- 쓰기가 필요한 디렉터리에 앱 사용자 권한이 있는가?
- 볼륨 마운트 시 호스트 디렉터리 소유권이 컨테이너 UID와 일치하는가?

---

**지난 글:** [Docker 보안 개요: 컨테이너 보안의 핵심 원칙](/posts/docker-security-overview/)

**다음 글:** [Docker Secrets: 시크릿 안전하게 관리하기](/posts/docker-secrets/)

<br>
읽어주셔서 감사합니다. 😊
