---
title: "PostgreSQL PITR과 베이스 백업 — 복구 시점 제어"
description: "pg_basebackup으로 베이스 백업을 만들고 WAL 아카이브를 활용해 특정 시점으로 되돌리는 PITR(Point-In-Time Recovery)의 동작 원리, archive_command 설정, recovery_target_time 지정까지 실전 순서로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["postgresql", "pitr", "backup", "wal-archive", "recovery", "베이스백업"]
featured: false
draft: false
---

[지난 글](/posts/pg-logical-replication/)에서 논리 복제를 통해 테이블 단위로 변경을 전파하는 방법을 살펴봤습니다. 이번에는 장애나 실수로 데이터가 손상됐을 때 **원하는 시점의 스냅샷으로 정밀하게 되돌리는** PITR(Point-In-Time Recovery)을 다룹니다.

## PITR의 핵심 아이디어

PostgreSQL은 모든 변경을 WAL에 기록합니다. 어느 시점의 **베이스 백업(Base Backup)** 과 그 이후의 **WAL 파일**만 있으면, 두 데이터를 합산해 원하는 시점의 데이터베이스 상태를 재현할 수 있습니다.

![PITR — 특정 시점으로 되돌리기](/assets/posts/pg-pitr-base-backup-concept.svg)

장애가 화요일 14:00에 발생했다면, 일요일 베이스 백업 + WAL 1~6을 재생해 13:30 상태로 복구합니다. WAL 7(장애 발생 구간)은 적용하지 않으므로 손상된 상태가 재현되지 않습니다.

## 베이스 백업 생성

```bash
# 운영 서버 데이터를 백업 서버로 복사
pg_basebackup \
  -h localhost \
  -U postgres \
  -D /backup/base_$(date +%Y%m%d) \
  --format=tar \       # 압축 전송
  --gzip \
  --checkpoint=fast \  # 즉시 체크포인트 수행
  -P                   # 진행 표시

# 백업 완료 확인
ls -lh /backup/base_20260516/
```

`pg_basebackup`은 실행 중인 서버에서 온라인 백업을 수행합니다. 백업 중에도 쓰기가 계속될 수 있습니다.

## WAL 아카이브 설정

![PITR 설정 — archive_command와 복구](/assets/posts/pg-pitr-base-backup-config.svg)

```sql
-- postgresql.conf 설정 후 서버 재시작 필요
-- archive_mode = on
-- archive_command = 'cp %p /mnt/wal/%f'

-- 아카이브 상태 모니터링
SELECT archived_count, last_archived_wal,
       last_archived_time, failed_count
FROM   pg_stat_archiver;
```

`archive_command`가 0이 아닌 종료 코드를 반환하면 PostgreSQL은 재시도합니다. 따라서 명령이 멱등성(idempotent)을 가져야 합니다. S3에 업로드하는 경우 `aws s3 cp --no-progress`를 사용해 기존 파일을 덮어쓸 수 있게 합니다.

## PITR 복구 절차

```bash
# 1. 복구 서버에 베이스 백업 복원
mkdir /var/lib/postgresql/data_recovery
tar -xzf /backup/base_20260510/base.tar.gz \
    -C /var/lib/postgresql/data_recovery

# 2. WAL 아카이브 위치 접근 가능하게 준비
# (NFS 마운트 또는 S3 설정)

# 3. postgresql.conf 수정 (복구 설정)
cat >> /var/lib/postgresql/data_recovery/postgresql.conf <<'EOF'
restore_command = 'cp /mnt/wal/%f %p'
recovery_target_time = '2026-05-13 13:30:00+09'
recovery_target_action = 'promote'
EOF

# 4. 복구 모드 트리거 파일 생성
touch /var/lib/postgresql/data_recovery/recovery.signal

# 5. 서버 기동 → WAL 재생 자동 시작
pg_ctl start -D /var/lib/postgresql/data_recovery
```

서버가 시작되면 `restore_command`로 WAL 파일을 가져오면서 `recovery_target_time`에 도달할 때까지 재생합니다. 목표 시점에 도달하면 `promote` 액션에 따라 정상 운영 모드로 전환합니다.

## 복구 대상 옵션

```sql
-- 특정 시각으로 복구 (가장 일반적)
recovery_target_time = '2026-05-13 13:30:00+09'

-- 특정 트랜잭션 ID 직전까지
recovery_target_xid = '12345678'

-- 특정 LSN 위치까지
recovery_target_lsn = '0/15000000'

-- 가능한 한 최근으로 (default)
recovery_target = 'immediate'   -- WAL 끝까지
```

운영 환경에서는 **삭제 실수 직전 시각**을 `recovery_target_time`으로 지정하는 경우가 가장 많습니다.

## 백업 주기와 보존 전략

| 백업 유형 | 주기 | 보존 기간 | 도구 |
|-----------|------|-----------|------|
| 베이스 백업 | 주 1회 이상 | 4주 | pg_basebackup, pgBackRest |
| WAL 아카이브 | 지속적 | 베이스 백업 이후 전체 | 파일 시스템, S3 |
| 논리 백업 | 일 1회 | 7일 | pg_dump |

WAL 아카이브는 베이스 백업보다 최신인 것을 모두 보존해야 PITR이 가능합니다. 베이스 백업을 삭제할 때 그것보다 오래된 WAL 파일도 함께 정리합니다.

---

**지난 글:** [PostgreSQL 논리 복제 — 선택적 복제와 버전 업그레이드](/posts/pg-logical-replication/)

**다음 글:** [pgBackRest와 Barman — PostgreSQL 백업 솔루션](/posts/pg-pgbackrest-barman/)

<br>
읽어주셔서 감사합니다. 😊
