---
title: "MySQL 스토리지 엔진 — InnoDB·MyISAM·Memory"
description: "MySQL의 플러그인 스토리지 엔진 구조를 살펴봅니다. InnoDB의 Buffer Pool·Redo/Undo Log·Doublewrite Buffer 내부 동작, MyISAM과의 결정적 차이, Memory·Archive 엔진 활용 상황을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "스토리지엔진", "buffer-pool", "mvcc", "myisam"]
featured: false
draft: false
---

[지난 글](/posts/mysql-architecture-overview/)에서 MySQL의 서버 레이어와 스토리지 엔진이 Handler API로 분리된 구조를 살펴봤습니다. 이번에는 각 스토리지 엔진의 내부를 구체적으로 들여다봅니다. 특히 현재 사실상 유일한 선택지인 InnoDB의 메모리·디스크 구조를 이해하면 MySQL 성능 튜닝의 60%를 이미 파악한 것입니다.

## InnoDB 내부 구조

![InnoDB 내부 구조](/assets/posts/mysql-storage-engines-innodb.svg)

InnoDB는 메모리와 디스크 두 영역으로 나뉩니다.

### Buffer Pool

InnoDB의 핵심은 **Buffer Pool**입니다. 테이블 데이터와 인덱스를 16KB 페이지 단위로 메모리에 캐시합니다. 페이지를 수정하면 먼저 Buffer Pool의 해당 페이지를 갱신(Dirty Page)하고, 나중에 디스크로 플러시합니다.

```sql
-- Buffer Pool 크기 설정 (총 RAM의 50~80% 권장)
-- my.cnf / my.ini
[mysqld]
innodb_buffer_pool_size = 8G
innodb_buffer_pool_instances = 8   -- 대용량 시 경합 분산

-- Buffer Pool 히트율 확인
SHOW ENGINE INNODB STATUS\G
-- Buffer pool hit rate: 1000 / 1000  ← 99% 이상이 목표
```

Buffer Pool 히트율이 95% 미만이면 디스크 I/O가 병목입니다. `innodb_buffer_pool_size`를 늘리거나 자주 사용하는 데이터를 줄이는 방향으로 접근합니다.

### Redo Log와 Undo Log

**Redo Log**(`ib_logfile0`, `ib_logfile1` 또는 MySQL 8.0.30+의 `#ib_redo*`)는 커밋된 변경을 기록하는 WAL 파일입니다. 서버가 충돌하면 Redo Log를 재생해 커밋된 데이터를 복구합니다.

**Undo Log**는 트랜잭션 롤백과 MVCC를 위한 이전 값을 저장합니다. SELECT가 트랜잭션 시작 시점의 스냅샷을 볼 수 있는 이유가 Undo Log입니다.

```sql
-- Redo Log 크기 조정 (MySQL 8.0.30+)
SET GLOBAL innodb_redo_log_capacity = 8 * 1024 * 1024 * 1024;  -- 8GB

-- Undo 테이블스페이스 확인
SELECT TABLESPACE_NAME, FILE_NAME, AUTOEXTEND_SIZE
FROM   information_schema.INNODB_TABLESPACES
WHERE  SPACE_TYPE = 'Undo';
```

### Doublewrite Buffer

InnoDB는 16KB 페이지를 디스크에 쓸 때 **두 번** 씁니다. 먼저 Doublewrite Buffer 영역에 기록하고, 그 다음 실제 테이블스페이스에 씁니다. 중간에 전원이 꺼져도 Doublewrite Buffer에서 페이지를 복구할 수 있어 **부분 쓰기(Partial Write)** 문제를 방지합니다.

## 스토리지 엔진 활용

![스토리지 엔진 선택 쿼리](/assets/posts/mysql-storage-engines-compare.svg)

### MyISAM — 레거시, 마이그레이션 필요

트랜잭션이 없고 테이블 수준 잠금을 사용합니다. 현재는 레거시 시스템에서만 만납니다.

```sql
-- MyISAM 테이블 InnoDB로 마이그레이션
ALTER TABLE old_myisam_table ENGINE = InnoDB;
-- 주의: 테이블 재구성으로 시간 소요, 운영 중 락 가능
-- pt-online-schema-change 또는 gh-ost 사용 권장
```

### Memory 엔진 — 세션 데이터, 임시 테이블

```sql
-- 세션 데이터 임시 저장 (서버 재시작 시 데이터 소실)
CREATE TABLE session_cache (
    token  CHAR(64) PRIMARY KEY,
    data   BLOB,
    expires DATETIME INDEX
) ENGINE = Memory MAX_ROWS = 100000;
```

서버 재시작 시 데이터가 사라지므로 영속성이 필요 없는 캐시에만 사용합니다. 해시 인덱스를 기본으로 사용해 등치 검색이 빠릅니다.

### Archive 엔진 — 압축 로그 저장

INSERT와 SELECT만 지원하며 zlib으로 압축 저장합니다. UPDATE/DELETE가 불가능하므로 감사 로그, 이벤트 히스토리 같은 추가-전용(append-only) 데이터에 적합합니다.

## InnoDB 성능 튜닝 핵심 변수

| 변수 | 설명 | 권장값 |
|------|------|--------|
| `innodb_buffer_pool_size` | 버퍼 풀 크기 | 총 RAM의 50~80% |
| `innodb_flush_log_at_trx_commit` | 커밋 시 로그 플러시 | `1`(안전) / `2`(성능) |
| `innodb_io_capacity` | 백그라운드 I/O 속도 | SSD: 2000~10000 |
| `innodb_read_io_threads` | 읽기 I/O 스레드 수 | 4~8 |
| `innodb_write_io_threads` | 쓰기 I/O 스레드 수 | 4~8 |

`innodb_flush_log_at_trx_commit=2`는 커밋 시 Redo Log를 OS 버퍼까지만 플러시합니다. OS 충돌 시 최대 1초치 데이터가 손실될 수 있지만 쓰기 성능이 크게 향상됩니다. ACID 완전 보장이 필요하면 `1`(기본값)을 유지합니다.

---

**지난 글:** [MySQL 아키텍처 개요 — 서버 레이어와 스토리지 엔진](/posts/mysql-architecture-overview/)

<br>
읽어주셔서 감사합니다. 😊
