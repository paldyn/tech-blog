---
title: "Docker 볼륨 백업과 복원: 데이터 보호 전략"
description: "Docker 볼륨에 저장된 데이터를 tar 아카이브로 백업하고 복원하는 방법, 볼륨 간 복사 패턴, 데이터베이스 볼륨 백업 시 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "backup", "restore", "백업", "복원"]
featured: false
draft: false
---

[지난 글](/posts/docker-volume-driver/)에서 볼륨 드라이버로 외부 스토리지를 연결하는 방법을 살펴봤다. 이번에는 **볼륨 데이터 백업과 복원**을 다룬다. Docker는 볼륨을 직접 복사하는 API를 제공하지 않는다. 임시 컨테이너를 통해 볼륨을 마운트한 뒤 `tar`로 아카이빙하는 방식이 표준 패턴이다.

## 백업 원리

볼륨 데이터는 호스트의 `/var/lib/docker/volumes/<name>/_data`에 저장된다. 이 경로를 직접 복사할 수도 있지만, Docker가 관리하는 내부 경로이므로 임시 컨테이너를 통해 접근하는 것이 더 이식성 있고 안전하다.

![볼륨 백업 흐름](/assets/posts/docker-volume-backup-flow.svg)

## 볼륨 백업

```bash
# 볼륨 내용을 tar.gz로 호스트에 저장
docker run --rm \
  -v mydb:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/mydb-$(date +%Y%m%d).tar.gz -C /data .
```

명령 분해:
- `-v mydb:/data`: 백업할 Named Volume을 컨테이너 `/data`에 마운트
- `-v $(pwd):/backup`: 호스트 현재 디렉터리를 컨테이너 `/backup`에 마운트 (아카이브 저장 위치)
- `tar czf /backup/...` : `/data` 내용을 `/backup`에 gzip 압축 아카이브로 저장
- `--rm`: 완료 후 임시 컨테이너 자동 삭제

## 볼륨 복원

```bash
# 백업 파일에서 볼륨으로 복원
docker run --rm \
  -v mydb-restore:/data \
  -v $(pwd):/backup \
  alpine \
  tar xzf /backup/mydb-20260515.tar.gz -C /data
```

- 대상 볼륨(`mydb-restore`)이 없으면 자동 생성
- 기존 볼륨에 복원하면 내용이 덮어씌워짐 → 중요한 경우 새 볼륨으로 복원 후 검증

## 백업·복원 명령어 한눈에

![백업·복원 전체 명령어](/assets/posts/docker-volume-backup-commands.svg)

## 볼륨 간 직접 복사

다른 이름의 볼륨으로 데이터를 이전할 때:

```bash
docker run --rm \
  -v source-vol:/from \
  -v dest-vol:/to \
  alpine \
  sh -c "cp -a /from/. /to/"

# rsync를 쓰면 증분 복사도 가능
docker run --rm \
  -v source-vol:/from \
  -v dest-vol:/to \
  alpine sh -c "apk add --no-cache rsync && rsync -av /from/ /to/"
```

## 데이터베이스 볼륨 백업 시 주의사항

파일 시스템 레벨에서 DB 데이터 디렉터리를 복사하면 DB가 실행 중일 때는 불일치(inconsistent) 상태의 백업이 생길 수 있다.

### PostgreSQL

```bash
# 권장: pg_dump로 논리 백업 (DB 실행 중에도 일관성 보장)
docker exec postgres \
  pg_dump -U postgres mydb \
  > backup-$(date +%Y%m%d).sql

# 전체 데이터베이스 클러스터 (pg_dumpall)
docker exec postgres \
  pg_dumpall -U postgres \
  > all-dbs-$(date +%Y%m%d).sql

# 복원
cat backup.sql | docker exec -i postgres psql -U postgres mydb
```

### MySQL / MariaDB

```bash
# mysqldump로 논리 백업
docker exec mysql \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --all-databases \
  > backup-$(date +%Y%m%d).sql

# 복원
cat backup.sql | docker exec -i mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD"
```

파일 시스템 레벨 백업이 필요하면 DB를 중지하거나 스냅샷 기능(MySQL InnoDB hot backup 등)을 사용한다.

## 자동화: cron 백업 컨테이너

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

  backup:
    image: alpine
    volumes:
      - pgdata:/data:ro
      - ./backups:/backup
    entrypoint: >
      sh -c "while true; do
        tar czf /backup/pgdata-$$(date +%Y%m%d-%H%M).tar.gz -C /data .;
        find /backup -mtime +7 -delete;
        sleep 86400;
      done"

volumes:
  pgdata:
```

백업 컨테이너가 볼륨을 `:ro`(읽기 전용)로 마운트해 데이터를 변경할 위험을 차단한다.

## 원격으로 백업 전송

```bash
# S3로 업로드 (awscli 활용)
docker run --rm \
  -v mydb:/data \
  -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  amazon/aws-cli \
  s3 cp - s3://my-bucket/backups/mydb-$(date +%Y%m%d).tar.gz \
  <<< "$(docker run --rm -v mydb:/data alpine tar czf - -C /data .)"

# 간단히: tar | ssh
docker run --rm -v mydb:/data alpine tar czf - -C /data . \
  | ssh user@backup-server "cat > /backups/mydb-$(date +%Y%m%d).tar.gz"
```

## 핵심 정리

- Docker는 볼륨 복사 API 없음 → 임시 컨테이너 + tar가 표준 방식
- 백업: `-v vol:/data` + `tar czf /backup/out.tar.gz -C /data .`
- 복원: `-v vol:/data` + `tar xzf /backup/out.tar.gz -C /data`
- DB 볼륨은 파일 레벨 백업 대신 `pg_dump`/`mysqldump` 논리 백업 권장
- 백업 컨테이너는 볼륨을 `:ro`로 마운트해 안전성 확보

---

**지난 글:** [Docker 볼륨 드라이버: 외부 스토리지 연결하기](/posts/docker-volume-driver/)

**다음 글:** [Docker 볼륨 권한 관리: 컨테이너 내 파일 접근 제어](/posts/docker-volume-permissions/)

<br>
읽어주셔서 감사합니다. 😊
