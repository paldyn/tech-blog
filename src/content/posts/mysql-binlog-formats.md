---
title: "MySQL 바이너리 로그 포맷 — STATEMENT·ROW·MIXED 완전 해설"
description: "MySQL 바이너리 로그의 세 가지 포맷(STATEMENT, ROW, MIXED)의 차이점, binlog_row_image 옵션, mysqlbinlog 조회, PITR 활용, 보존 관리 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["MySQL", "바이너리로그", "binlog", "ROW", "STATEMENT", "PITR", "리플리케이션"]
featured: false
draft: false
---

[지난 글](/posts/mysql-gtid-replication/)에서 GTID 기반 리플리케이션의 자동 포지션 추적을 다뤘다. GTID와 함께 반드시 이해해야 할 것이 바이너리 로그 포맷이다. 포맷 선택은 리플리케이션 안정성, 로그 크기, PITR(Point-In-Time Recovery) 가능 여부에 직접 영향을 미친다.

## 바이너리 로그란

바이너리 로그(binlog)는 MySQL 서버에서 발생한 데이터 변경 이벤트를 순서대로 기록하는 파일이다. 리플리케이션에서 Primary가 Replica에 변경 사항을 전달하는 채널이고, PITR에서는 특정 시점 직전까지 변경을 재적용하는 수단이다.

```sql
-- 바이너리 로그 활성화 확인
SHOW VARIABLES LIKE 'log_bin%';
-- log_bin = ON 이어야 함

-- 현재 포맷 확인
SHOW VARIABLES LIKE 'binlog_format';

-- 현재 binlog 파일 목록
SHOW BINARY LOGS;

-- 현재 쓰고 있는 파일
SHOW MASTER STATUS;  -- 8.0.22 이후: SHOW BINARY LOG STATUS
```

## 세 가지 포맷 비교

![바이너리 로그 포맷 3종 비교](/assets/posts/mysql-binlog-formats-comparison.svg)

### STATEMENT 포맷

SQL 문 그 자체를 바이너리 로그에 기록한다. `UPDATE orders SET status='paid' WHERE id=1`이라는 문이 실행되면 해당 문자열 그대로 기록된다. 로그 크기가 작고 사람이 읽기 쉽다는 장점이 있지만 결정론적이지 않은 함수가 포함된 SQL에서 Primary와 Replica 사이에 데이터 불일치가 발생할 수 있다.

```sql
-- 비결정적 함수 예시 — STATEMENT에서 위험
INSERT INTO audit_log (ts, info) VALUES (NOW(), UUID());
-- Primary의 NOW() 결과와 Replica에서 재실행된 NOW()가 다를 수 있음
```

### ROW 포맷

변경된 행의 **데이터 값**을 기록한다. `UPDATE`가 실행되면 변경 전 행과 변경 후 행의 컬럼 값이 모두 바이너리로 기록된다. `NOW()`나 `UUID()`가 포함된 문이더라도 이미 평가된 값이 기록되므로 Replica에서 동일한 결과가 보장된다. MySQL 8.0의 기본값이며 GTID와 함께 프로덕션 환경의 표준 조합이다.

```sql
-- 세션 레벨로 포맷 변경 (테스트용)
SET SESSION binlog_format = 'ROW';
SET SESSION binlog_format = 'STATEMENT';

-- 재시작 없이 글로벌 변경 (MySQL 8.0.27+에서 동적 적용)
SET GLOBAL binlog_format = 'ROW';
```

### MIXED 포맷

결정론적 SQL은 STATEMENT로, 비결정론적 SQL은 자동으로 ROW로 전환한다. 로그 크기를 줄이려는 타협안이었지만 어떤 문이 어떤 포맷으로 기록됐는지 예측하기 어렵고 트러블슈팅이 복잡하다. 신규 구성에서는 ROW를 직접 사용하는 것이 낫다.

## ROW 이미지 크기 조절

ROW 포맷은 변경된 행 데이터를 모두 기록하므로 로그 크기가 STATEMENT보다 클 수 있다. `binlog_row_image` 옵션으로 기록 범위를 조절한다.

![ROW 이미지 옵션 & binlog 관리](/assets/posts/mysql-binlog-formats-row-image.svg)

```ini
# my.cnf
binlog_format    = ROW
binlog_row_image = FULL     # 기본값: 변경 전/후 모든 컬럼
# binlog_row_image = MINIMAL  # PK + 변경된 컬럼만 (크기 최소)
# binlog_row_image = NOBLOB   # BLOB/TEXT 미변경 시 제외
```

`MINIMAL`은 로그 크기를 크게 줄일 수 있지만 모든 테이블에 PK가 있어야 한다. PK가 없는 테이블에서는 자동으로 `FULL`로 폴백된다. 일반적으로는 `FULL`을 유지하고, 용량이 문제가 될 때 `MINIMAL`을 검토한다.

## mysqlbinlog로 내용 조회

ROW 포맷 binlog는 바이너리 인코딩이므로 `-v` 플래그로 사람이 읽을 수 있는 형태로 변환해야 한다.

```bash
# 기본 조회
mysqlbinlog --base64-output=DECODE-ROWS -v /var/lib/mysql/binlog.000001

# 특정 시간 범위
mysqlbinlog \
  --start-datetime="2026-05-20 10:00:00" \
  --stop-datetime="2026-05-20 11:00:00" \
  --base64-output=DECODE-ROWS -v \
  /var/lib/mysql/binlog.000001

# 특정 DB·테이블 필터
mysqlbinlog -d mydb --base64-output=DECODE-ROWS -v binlog.000001

# 원격 서버에서 직접 스트림 (MySQL 8.0)
mysqlbinlog \
  --read-from-remote-server \
  --host=192.168.1.10 --user=root \
  --base64-output=DECODE-ROWS -v \
  binlog.000001 | grep -A5 "UPDATE\|INSERT\|DELETE"
```

## PITR (Point-In-Time Recovery)

전체 백업 이후 특정 시점까지 복구하려면 binlog를 재적용한다.

```bash
# 1. 전체 백업 복구 (mysqldump 예시)
mysql < full_backup_2026-05-19.sql

# 2. 백업 이후 특정 시점까지 binlog 적용
mysqlbinlog \
  --start-datetime="2026-05-19 23:00:00" \
  --stop-datetime="2026-05-20 09:30:00" \
  /var/lib/mysql/binlog.000010 \
  /var/lib/mysql/binlog.000011 \
  | mysql -u root -p

# GTID 기반 복구: 특정 GTID까지만 적용
mysqlbinlog \
  --include-gtids="aaaa-bbbb:1-500" \
  --base64-output=AUTO \
  binlog.000010 | mysql -u root -p
```

PITR이 가능하려면 `log_bin = ON`이 설정되어 있어야 하고, binlog 파일이 보존되어 있어야 한다.

## binlog 보존 관리

```sql
-- 보존 기간 설정 (초 단위, MySQL 8.0)
SET GLOBAL binlog_expire_logs_seconds = 604800;  -- 7일

-- 수동 삭제 (Replica 진행 상태 확인 후)
SHOW REPLICA STATUS\G
-- Retrieved_Gtid_Set, Executed_Gtid_Set 비교

-- 특정 날짜 이전 파일 삭제
PURGE BINARY LOGS BEFORE '2026-05-13 00:00:00';

-- 특정 파일 이전까지 삭제
PURGE BINARY LOGS TO 'binlog.000050';
```

Replica가 아직 소비하지 못한 binlog를 삭제하면 `Got fatal error 1236` 오류가 발생하며 리플리케이션이 중단된다. `SHOW REPLICA STATUS`의 `Master_Log_File`을 확인해 Replica가 읽고 있는 파일보다 오래된 것만 삭제해야 한다.

## binlog 압축

MySQL 8.0.20+에서는 binlog 이벤트 자체를 zstd로 압축할 수 있다.

```sql
-- binlog 압축 활성화
SET GLOBAL binlog_transaction_compression = ON;

-- 압축률 확인
SELECT
  COMPRESSION_TYPE,
  TRANSACTION_SIZE_UNCOMPRESSED,
  TRANSACTION_SIZE_COMPRESSED
FROM performance_schema.binary_log_transaction_compression_stats;
```

ROW 포맷 + 반복적인 데이터 패턴에서 50~70% 압축률을 달성하기도 한다. 단, CPU 사용량이 증가하므로 워크로드를 확인하며 적용한다.

---

**지난 글:** [MySQL GTID 리플리케이션 — 자동 포지션 추적과 무중단 Failover](/posts/mysql-gtid-replication/)

**다음 글:** [MySQL 파티셔닝 — 대용량 테이블 분할 전략](/posts/mysql-partitioning/)

<br>
읽어주셔서 감사합니다. 😊
