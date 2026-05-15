---
title: "pgBackRest와 Barman — PostgreSQL 백업 솔루션"
description: "pg_basebackup보다 풍부한 기능을 제공하는 pgBackRest와 Barman의 핵심 기능, 증분/차등 백업, S3 연동, PITR 복구 명령어를 비교하고 선택 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["postgresql", "pgbackrest", "barman", "backup", "pitr", "백업솔루션"]
featured: false
draft: false
---

[지난 글](/posts/pg-pitr-base-backup/)에서 `pg_basebackup`과 WAL 아카이브로 PITR을 구성하는 방법을 살펴봤습니다. `pg_basebackup`은 단순하지만, 운영 환경에서는 증분 백업, 병렬 처리, 보존 정책 자동화가 필요합니다. 이 요구를 충족하는 전용 도구가 **pgBackRest**와 **Barman**입니다.

## pgBackRest vs Barman

![pgBackRest vs Barman 비교](/assets/posts/pg-pgbackrest-barman-compare.svg)

두 도구 모두 PostgreSQL 전용으로 설계되어 `pg_basebackup`이 제공하지 않는 기능들을 갖추고 있습니다.

- **pgBackRest**: C로 구현된 고성능 도구. 병렬 처리와 S3 네이티브 지원이 강점.
- **Barman**: Python 기반. 복제 클러스터를 중앙에서 관리하는 아키텍처에 적합.

## pgBackRest 설정 및 사용

### 설치 및 기본 설정

```ini
# /etc/pgbackrest/pgbackrest.conf
[global]
repo1-path=/var/lib/pgbackrest
repo1-retention-full=2     # 풀 백업 2개 보존

# S3 저장소 사용 시
repo1-type=s3
repo1-s3-bucket=my-pg-backup
repo1-s3-region=ap-northeast-2

[main]
pg1-path=/var/lib/postgresql/data
pg1-port=5432
```

```bash
# Stanza 초기화 (최초 1회)
pgbackrest --stanza=main stanza-create

# 설정 검증
pgbackrest --stanza=main check
```

### 백업과 복구

![pgBackRest 주요 명령어](/assets/posts/pg-pgbackrest-barman-cmd.svg)

```bash
# 백업 목록 확인
pgbackrest --stanza=main info

# 결과 예시
# stanza: main
#   status: ok
#   full backup: 20260510-020000F
#     timestamp stop/start: 2026-05-10 02:00:00 / 2026-05-10 02:12:34
#   incr backup: 20260510-020000F_20260511-020000I
#     timestamp stop/start: 2026-05-11 02:00:00 / 2026-05-11 02:01:45
```

pgBackRest는 증분 백업 시 변경된 8KB 페이지 단위로만 복사합니다. 수 TB 데이터베이스에서도 증분 백업이 수 분 내에 완료됩니다.

### 병렬 처리 설정

```ini
# 백업/복구 시 병렬 프로세스 수
process-max=4
```

코어 수에 맞춰 병렬도를 설정하면 백업/복구 시간이 크게 단축됩니다.

## Barman 설정 및 사용

Barman은 별도의 백업 서버에서 운영 PostgreSQL을 중앙 관리합니다.

```bash
# /etc/barman.conf
[main]
description = "Main PostgreSQL"
conninfo = host=pg_primary user=barman dbname=postgres
streaming_conninfo = host=pg_primary user=streaming_barman
backup_method = postgres    # pg_basebackup 방식
streaming_archiver = on     # WAL 스트리밍으로 수신
retention_policy = RECOVERY WINDOW OF 7 DAYS

# 백업 실행
barman backup main

# 복구 서버로 복원
barman recover main latest \
  --target-time "2026-05-13 13:30:00" \
  --remote-ssh-command "ssh postgres@recovery_host" \
  /var/lib/postgresql/data
```

`barman check main`으로 연결, 아카이브, 복제 상태를 한 번에 진단할 수 있습니다.

## 보존 정책 자동화

두 도구 모두 오래된 백업 자동 삭제를 지원합니다.

| 정책 유형 | pgBackRest 설정 | Barman 설정 |
|-----------|----------------|------------|
| 풀 백업 개수 | `retention-full=2` | `minimum_redundancy = 2` |
| 복구 가능 기간 | WAL 보존으로 제어 | `retention_policy = RECOVERY WINDOW OF 7 DAYS` |

## 선택 가이드

- **pgBackRest**: 클라우드(AWS, GCP, Azure) 환경, S3 직접 저장, 대용량 DB(수 TB), 빠른 병렬 복구가 필요할 때.
- **Barman**: 온프레미스 중앙 백업 서버, PostgreSQL 복제 클러스터 전체를 한 곳에서 관리, DBA 중심 운영 체계.

---

**지난 글:** [PostgreSQL PITR과 베이스 백업 — 복구 시점 제어](/posts/pg-pitr-base-backup/)

**다음 글:** [PgBouncer — PostgreSQL 커넥션 풀링](/posts/pg-pgbouncer/)

<br>
읽어주셔서 감사합니다. 😊
