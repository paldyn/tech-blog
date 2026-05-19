---
title: "MySQL 백업 — mysqldump와 Percona XtraBackup 완전 가이드"
description: "MySQL 논리 백업(mysqldump)과 물리 백업(Percona XtraBackup)의 원리, 옵션, 증분 백업, PITR, 복구 절차, 실전 운영 패턴을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["MySQL", "백업", "mysqldump", "XtraBackup", "PITR", "증분백업", "복구"]
featured: false
draft: false
---

[지난 글](/posts/mysql-partitioning/)에서 대용량 테이블을 파티션으로 분할하는 전략을 다뤘다. 파티셔닝이 성능 문제를 해결한다면, 백업은 데이터 안전을 보장한다. MySQL 백업 전략의 두 기둥인 **mysqldump**(논리 백업)와 **Percona XtraBackup**(물리 백업)을 사용 상황별로 깊이 살펴본다.

## 논리 백업 vs 물리 백업

![MySQL 백업 방법 비교](/assets/posts/mysql-backup-methods.svg)

논리 백업은 데이터를 SQL 문이나 CSV로 추출하고, 물리 백업은 데이터 파일 자체를 복사한다. 소규모 DB나 스키마 마이그레이션에는 mysqldump가 충분하지만, 수백 GB 이상의 프로덕션 DB라면 XtraBackup이 사실상 필수다.

## mysqldump

```bash
# 기본 전체 백업 (InnoDB, 무잠금)
mysqldump \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --master-data=2 \
  -u root -p \
  --all-databases > /backup/full_$(date +%Y%m%d).sql

# 특정 DB만
mysqldump --single-transaction -u root -p mydb > mydb.sql

# 특정 테이블
mysqldump --single-transaction -u root -p mydb orders users > tables.sql

# 압축
mysqldump --single-transaction -u root -p mydb | gzip > mydb.sql.gz
```

`--single-transaction`은 InnoDB 테이블에서 일관성 있는 스냅샷을 확보한다. 트랜잭션을 시작한 시점의 뷰를 유지하므로 서비스 중단 없이 백업 가능하다. MyISAM 테이블이 혼재하면 이 옵션이 효과 없으므로 `--lock-all-tables`가 필요하다.

`--master-data=2`는 현재 binlog 파일명과 포지션을 SQL 주석으로 삽입한다. PITR의 시작점이 된다.

### 복구

```bash
# 전체 DB 복구
mysql -u root -p < /backup/full_20260520.sql

# 압축 복구
gunzip -c mydb.sql.gz | mysql -u root -p mydb

# 단일 테이블 추출 (sed 활용)
sed -n '/^-- Table structure for `orders`/,/^-- Table structure for/p' full.sql \
  | mysql -u root -p mydb
```

### mysqldump 성능 개선

```bash
# 병렬 덤프 (mydumper 사용 — mysqldump 대안)
mydumper \
  --threads=4 \
  --compress \
  --outputdir=/backup/mydumper_$(date +%Y%m%d) \
  --database mydb

# 복구
myloader --threads=4 --directory=/backup/mydumper_20260520 --database mydb
```

`mydumper`는 테이블 단위 병렬 처리로 mysqldump보다 10배 이상 빠른 경우가 많다. 대용량 DB의 논리 백업에 권장한다.

## Percona XtraBackup

XtraBackup은 InnoDB 엔진의 내부 API를 활용해 서비스 중단 없이 데이터 파일을 복사하는 핫 백업 도구다. 백업 중 변경된 내용은 InnoDB redo log를 재적용해 일관성을 보장한다.

![XtraBackup 전체·증분 백업 플로우](/assets/posts/mysql-backup-xtrabackup-flow.svg)

### 전체 백업

```bash
# 설치 (MySQL 8.0 기준 XtraBackup 8.0)
# https://www.percona.com/downloads/

# 전체 백업
xtrabackup \
  --backup \
  --user=root \
  --password=secret \
  --target-dir=/backup/full

# 백업 후 prepare (redo log 재적용)
xtrabackup \
  --prepare \
  --target-dir=/backup/full

# datadir로 복사
systemctl stop mysql
xtrabackup \
  --copy-back \
  --target-dir=/backup/full \
  --datadir=/var/lib/mysql

chown -R mysql:mysql /var/lib/mysql
systemctl start mysql
```

### 증분 백업

```bash
# Day 0: 전체 백업
xtrabackup --backup --target-dir=/backup/full

# Day 1: 전체 백업 기준 증분
xtrabackup --backup \
  --target-dir=/backup/inc1 \
  --incremental-basedir=/backup/full

# Day 2: 전날 증분 기준 증분
xtrabackup --backup \
  --target-dir=/backup/inc2 \
  --incremental-basedir=/backup/inc1

# --- 복구 시: prepare 순서 중요 ---
# 1. 전체 백업 prepare (--apply-log-only: redo 미완료 상태 유지)
xtrabackup --prepare --apply-log-only \
  --target-dir=/backup/full

# 2. Inc1 적용
xtrabackup --prepare --apply-log-only \
  --target-dir=/backup/full \
  --incremental-dir=/backup/inc1

# 3. Inc2 적용 (마지막이므로 --apply-log-only 없음)
xtrabackup --prepare \
  --target-dir=/backup/full \
  --incremental-dir=/backup/inc2

# 4. 복사 및 시작
systemctl stop mysql
xtrabackup --copy-back --target-dir=/backup/full
chown -R mysql:mysql /var/lib/mysql
systemctl start mysql
```

마지막 `--prepare`에서 `--apply-log-only`를 빼야 uncommitted 트랜잭션이 롤백되고 DB가 일관된 상태가 된다.

### 새 Replica 구축

XtraBackup의 가장 빛나는 활용 사례는 새 Replica를 빠르게 구축하는 것이다.

```bash
# Primary에서 백업 후 Replica로 전송
xtrabackup --backup --target-dir=/tmp/xb_for_replica
rsync -avz /tmp/xb_for_replica/ replica_host:/var/lib/mysql/

# Primary에서 (백업 완료 후)
cat /tmp/xb_for_replica/xtrabackup_binlog_info
# binlog.000010  12345  aaaa-bbbb-cccc:1-200  ← GTID 정보

# Replica에서
xtrabackup --prepare --target-dir=/var/lib/mysql
chown -R mysql:mysql /var/lib/mysql
systemctl start mysql

mysql -u root -p <<'EOF'
RESET REPLICA ALL;
SET @@GLOBAL.GTID_PURGED = 'aaaa-bbbb-cccc:1-200';
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = 'primary_host',
  SOURCE_AUTO_POSITION = 1;
START REPLICA;
EOF
```

수TB 규모의 DB도 XtraBackup + rsync 조합으로 몇 시간 내에 Replica를 추가할 수 있다.

## PITR (Point-In-Time Recovery)

```bash
# 1. XtraBackup 복구로 DB를 특정 일자로 복원
xtrabackup --prepare --target-dir=/backup/full
xtrabackup --copy-back --target-dir=/backup/full
chown -R mysql:mysql /var/lib/mysql
systemctl start mysql

# 2. 백업 이후 특정 시점까지 binlog 적용
# xtrabackup_binlog_info에서 시작 GTID 확인
cat /backup/full/xtrabackup_binlog_info

# binlog 파일에서 실수 직전까지 적용
mysqlbinlog \
  --start-datetime="2026-05-20 00:00:00" \
  --stop-datetime="2026-05-20 09:29:59" \
  /var/lib/mysql/binlog.000010 \
  /var/lib/mysql/binlog.000011 \
  | mysql -u root -p
```

## 백업 자동화 스크립트 예시

```bash
#!/bin/bash
# /etc/cron.d/mysql-backup
BACKUP_DIR=/backup/mysql
DATE=$(date +%Y%m%d)

# 주 1회 전체 백업 (일요일)
if [ "$(date +%u)" = "7" ]; then
  xtrabackup --backup --target-dir="${BACKUP_DIR}/full_${DATE}"
  # 14일 이전 전체 백업 삭제
  find "${BACKUP_DIR}" -name "full_*" -mtime +14 -exec rm -rf {} +
else
  # 평일 증분 백업
  LAST_FULL=$(ls -td "${BACKUP_DIR}"/full_* | head -1)
  xtrabackup --backup \
    --target-dir="${BACKUP_DIR}/inc_${DATE}" \
    --incremental-basedir="${LAST_FULL}"
fi
```

백업 완료 후에는 반드시 복구 훈련을 주기적으로 실시해야 한다. 백업이 있어도 복구가 안 된다면 의미가 없다.

---

**지난 글:** [MySQL 파티셔닝 — 대용량 테이블 분할 전략](/posts/mysql-partitioning/)

**다음 글:** [ProxySQL & MySQL Router — MySQL 연결 프록시 완전 가이드](/posts/mysql-proxysql-router/)

<br>
읽어주셔서 감사합니다. 😊
