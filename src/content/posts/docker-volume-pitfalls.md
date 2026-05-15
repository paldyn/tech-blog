---
title: "Docker 볼륨 함정과 해결책: 자주 만나는 문제들"
description: "Docker 볼륨 사용 시 실무에서 자주 마주치는 7가지 함정(익명 볼륨 누적, 권한 에러, 이미지 파일 덮어쓰기 등)과 각 해결책을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "트러블슈팅", "함정", "pitfall", "데이터 관리"]
featured: false
draft: false
---

[지난 글](/posts/docker-volume-permissions/)에서 볼륨 권한 문제를 다뤘다. 이번에는 볼륨 관련 **자주 겪는 함정들**을 모아 원인과 해결책을 정리한다. 각 항목은 독립적이므로 필요한 부분만 골라 참고해도 좋다.

## 7가지 주요 함정

![Docker 볼륨 주요 함정 7가지](/assets/posts/docker-volume-pitfalls-list.svg)

---

## 함정 ①: DB 이미지 VOLUME 선언을 모르고 지나치기

MySQL, PostgreSQL, MongoDB 공식 이미지는 데이터 디렉터리에 `VOLUME` 선언이 포함되어 있다. Named Volume을 지정하지 않으면 실행할 때마다 새 익명 볼륨이 생성된다.

```bash
# 잘못된 방법: 매번 새 익명 볼륨 생성
docker run -d mysql:8
docker run -d mysql:8
# docker volume ls → 해시 이름 볼륨 2개

# 올바른 방법: Named Volume 명시
docker run -d -v mydb:/var/lib/mysql mysql:8
```

공식 이미지의 `VOLUME` 경로는 `docker inspect 이미지명 --format '{{json .Config.Volumes}}'`로 확인할 수 있다.

---

## 함정 ②: `docker rm`으로 볼륨이 삭제된다는 착각

Named Volume은 `docker rm`으로 컨테이너를 삭제해도 자동으로 삭제되지 않는다. 의도적으로 삭제하려면 별도 명령이 필요하다.

```bash
docker rm my-container          # 컨테이너만 삭제, Named Volume 유지
docker rm -v my-container       # 익명 볼륨만 함께 삭제 (Named Volume 제외)
docker volume rm my-named-vol   # Named Volume 명시 삭제
docker volume prune             # 미사용 볼륨 일괄 삭제
```

역으로, 데이터를 유지해야 하는데 실수로 `prune`을 실행하면 데이터가 영구 삭제된다. `prune` 전에 반드시 `docker volume ls`로 목록을 확인한다.

---

## 함정 ③: Bind Mount로 이미지 내 파일 덮어쓰기

호스트 디렉터리를 컨테이너의 기존 경로에 Bind Mount하면 이미지 안의 파일이 가려진다.

```bash
# 이미지 안에 /app/node_modules가 설치되어 있어도
# 호스트 ./myapp을 /app에 마운트하면 node_modules가 보이지 않는다
docker run -v $(pwd)/myapp:/app node:20 node server.js
# Error: Cannot find module './node_modules/...'
```

해결: `node_modules`를 Anonymous Volume으로 분리해 Bind Mount가 덮어쓰지 못하게 한다.

```bash
docker run \
  -v $(pwd)/myapp:/app \
  -v /app/node_modules \   # 이 경로는 컨테이너 이미지의 내용 사용
  node:20 node server.js
```

---

## 함정 ④: Permission denied (UID 불일치)

볼륨 파일 소유자의 UID와 컨테이너 프로세스 UID가 다를 때 발생한다. 자세한 해결 방법은 [볼륨 권한 관리 글](/posts/docker-volume-permissions/)을 참고한다.

```bash
# 빠른 해결: --user로 UID 일치
docker run --user $(id -u):$(id -g) -v $(pwd)/data:/app/data my-app

# 또는 초기화 컨테이너로 소유권 설정
docker run --rm -v mydata:/data alpine chown -R 1000:1000 /data
```

---

## 함정 ⑤: DB 실행 중 파일 레벨 백업

MySQL, PostgreSQL의 데이터 디렉터리를 DB가 실행 중인 상태에서 `tar`로 복사하면 불일치(inconsistent) 상태의 백업이 생긴다. 복원 시 DB가 손상될 수 있다.

```bash
# 위험한 방법 (DB 실행 중)
docker run --rm -v pgdata:/data alpine tar czf - -C /data .

# 올바른 방법: 논리 백업
docker exec postgres pg_dump -U postgres mydb > backup.sql

# 또는 DB를 중지 후 파일 레벨 백업
docker stop postgres
docker run --rm -v pgdata:/data alpine tar czf - -C /data .
docker start postgres
```

---

## 함정 ⑥: tmpfs를 영속 데이터에 사용

tmpfs 마운트는 컨테이너 재시작(`docker restart`)에도 초기화된다. 세션 토큰이나 소켓 파일 같은 임시 데이터에만 사용하고, 영속이 필요한 데이터에는 Named Volume을 사용한다.

```bash
# tmpfs에 쓴 데이터
docker run --tmpfs /data my-app
# docker restart my-app → /data 비어있음
```

---

## 함정 ⑦: 볼륨 이름 충돌

같은 호스트에서 여러 프로젝트가 동일한 볼륨 이름을 사용하면 데이터가 섞인다.

```bash
# 프로젝트 A: postgres 볼륨 이름 pgdata
# 프로젝트 B: 같은 이름 pgdata → 프로젝트 A 데이터 덮어씌워짐 가능

# 해결: 프로젝트명 접두사 사용
docker volume create project-a_pgdata
docker volume create project-b_pgdata
```

Docker Compose는 프로젝트 이름을 자동으로 접두사로 붙인다 (`docker compose -p project-a up`).

---

## 체크리스트

![볼륨 사용 체크리스트](/assets/posts/docker-volume-pitfalls-checklist.svg)

```bash
# 볼륨 상태 확인 명령어 모음
docker volume ls                         # 전체 볼륨 목록
docker volume ls --filter dangling=true  # 고아 볼륨 목록
docker volume inspect vol-name           # 볼륨 상세 정보
docker system df                         # 전체 Docker 디스크 사용량
docker system df -v                      # 볼륨별 상세 사용량
```

## 핵심 정리

- DB 이미지 `VOLUME` 선언 → 반드시 Named Volume 명시
- `docker rm`은 Named Volume을 삭제하지 않는다 → `volume rm` 또는 `volume prune`
- Bind Mount + node_modules 충돌 → Anonymous Volume으로 분리
- UID 불일치 → `chown` 또는 `--user`
- DB 백업 → `pg_dump`/`mysqldump` 사용, 파일 레벨 tar는 DB 중지 후
- tmpfs는 영속 데이터에 사용 금지
- 볼륨 이름에 프로젝트 접두사 관례 사용

---

**지난 글:** [Docker 볼륨 권한 관리: 컨테이너 내 파일 접근 제어](/posts/docker-volume-permissions/)

**다음 글:** [Docker 네트워크 개요: 컨테이너 통신의 기초](/posts/docker-network-overview/)

<br>
읽어주셔서 감사합니다. 😊
