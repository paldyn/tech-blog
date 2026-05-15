---
title: "VOLUME 인스트럭션 완전 정복"
description: "Dockerfile VOLUME 인스트럭션이 익명 볼륨을 만드는 원리, 선언 순서에 따른 데이터 포함 여부, docker run -v로의 오버라이드, VOLUME의 실전 한계와 대안을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "VOLUME", "볼륨", "데이터영속성", "익명볼륨"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-expose/)에서 포트 문서화 역할을 하는 EXPOSE를 살펴봤다. 이번에는 데이터 영속성을 위한 `VOLUME` 인스트럭션을 파고든다.

## VOLUME 인스트럭션이란

`VOLUME`은 컨테이너가 시작될 때 지정한 경로에 **익명 볼륨**을 자동으로 마운트하게 만드는 인스트럭션이다. 해당 경로의 데이터는 컨테이너 레이어가 아니라 Docker 볼륨 저장소(호스트 `/var/lib/docker/volumes/`)에 저장된다.

```dockerfile
VOLUME /data
VOLUME ["/data", "/logs"]
```

![VOLUME 인스트럭션 동작 원리](/assets/posts/dockerfile-volume-overview.svg)

## 핵심 동작 특성

### 1. 컨테이너 삭제 후에도 데이터 유지

```bash
docker run --name db mydb
# 컨테이너 삭제해도 VOLUME 경로 데이터는 볼륨에 남음
docker rm db
docker volume ls   # 익명 볼륨이 남아있음
```

컨테이너가 삭제돼도 볼륨은 삭제되지 않는다(`docker rm -v`를 써야 볼륨도 함께 삭제된다).

### 2. 각 컨테이너마다 별도 익명 볼륨

```bash
# 두 컨테이너는 서로 다른 익명 볼륨을 가짐
docker run mydb  # → 볼륨 a 생성
docker run mydb  # → 볼륨 b 생성
```

같은 이미지를 여러 번 실행하면 컨테이너마다 **별도의 익명 볼륨**이 만들어진다. 데이터를 공유하려면 명명 볼륨(`-v myvolume:/data`)이나 바인드 마운트(`-v /host/path:/data`)를 사용해야 한다.

### 3. VOLUME 선언 이후의 RUN은 이미지에 반영 안 됨

![VOLUME 문법과 주의사항](/assets/posts/dockerfile-volume-code.svg)

```dockerfile
# 잘못된 순서 — VOLUME 후의 RUN은 이미지에 저장되지 않음
VOLUME /data
RUN echo "seed data" > /data/seed.txt   # 이미지에 포함 안 됨

# 올바른 순서 — RUN으로 초기 파일 생성 후 VOLUME 선언
RUN echo "seed data" > /data/seed.txt   # 이미지에 포함됨
VOLUME /data
```

`VOLUME`을 선언하면 해당 경로가 볼륨으로 전환되므로, **선언 이후의 `RUN` 명령이 그 경로에 쓴 내용은 이미지 레이어에 포함되지 않는다**. 초기 데이터가 필요하면 `VOLUME` 선언 전에 파일을 만들어야 한다.

## docker run -v로 오버라이드

```bash
# 명명 볼륨으로 교체 (권장)
docker run -v mydata:/data mydb

# 바인드 마운트로 교체
docker run -v /host/data:/data mydb

# VOLUME 없이 실행하면 익명 볼륨이 자동 생성됨
docker run mydb
```

`docker run -v`로 명명 볼륨이나 바인드 마운트를 지정하면 Dockerfile의 `VOLUME` 익명 볼륨을 **대체**한다.

## 실전에서 VOLUME의 한계

```yaml
# Compose: 명명 볼륨으로 교체하는 것이 일반적
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data  # Dockerfile의 VOLUME 경로와 동일

volumes:
  pgdata:
```

실제 프로젝트에서는 Dockerfile의 `VOLUME`이 만드는 익명 볼륨을 그대로 사용하는 경우가 드물다. Compose나 `docker run -v`로 **명명 볼륨**을 지정하는 것이 이름으로 관리하고 백업하기 편리하다.

## VOLUME 사용 권장 시나리오

```dockerfile
# 데이터베이스 데이터 디렉터리
FROM postgres:16
VOLUME /var/lib/postgresql/data

# 업로드 파일 저장
FROM myapp:latest
VOLUME /app/uploads

# 로그 파일 (호스트에서 쉽게 접근)
VOLUME /app/logs
```

- **데이터베이스** 데이터 디렉터리 — 컨테이너 재시작 간 데이터 유지
- **사용자 업로드 파일** — 배포와 독립적으로 관리
- **로그 파일** — 컨테이너 외부에서 수집·모니터링

## VOLUME을 쓰지 않아야 할 경우

```dockerfile
# 빌드 결과물 — 이미지에 포함돼야 함 → VOLUME 쓰면 안 됨
RUN npm run build
# VOLUME /app/dist  ← 이렇게 하면 빌드 결과가 이미지에 포함 안 됨!
```

빌드 아티팩트, 설정 파일처럼 **이미지 안에 포함돼야 하는 파일**의 경로에는 `VOLUME`을 선언하면 안 된다.

## 핵심 정리

- `VOLUME`은 컨테이너 실행 시 해당 경로에 **익명 볼륨**을 자동 마운트
- 선언 **이후** `RUN`으로 해당 경로에 쓴 내용은 이미지에 포함 안 됨 — 순서가 중요
- `docker run -v`로 명명 볼륨/바인드 마운트를 지정하면 익명 볼륨이 대체됨
- 실제 프로젝트에서는 Compose `volumes:`로 명명 볼륨을 관리하는 것이 일반적

---

**지난 글:** [EXPOSE 인스트럭션 완전 정복](/posts/dockerfile-expose/)

**다음 글:** [USER 인스트럭션 완전 정복](/posts/dockerfile-user/)

<br>
읽어주셔서 감사합니다. 😊
