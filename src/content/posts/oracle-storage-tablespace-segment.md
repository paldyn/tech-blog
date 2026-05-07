---
title: "Oracle 스토리지 구조: 테이블스페이스·세그먼트·익스텐트·블록"
description: "Oracle 물리적·논리적 스토리지 계층(테이블스페이스, 세그먼트, 익스텐트, 데이터 블록)의 관계와 설계 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["oracle", "tablespace", "segment", "extent", "data-block", "storage", "lmt", "assm", "undo", "temp"]
featured: false
draft: false
---

[지난 글](/posts/oracle-background-processes/)에서 Oracle 백그라운드 프로세스가 메모리와 디스크 사이를 어떻게 중재하는지 살펴봤다. 이번에는 그 디스크 공간이 논리적으로 어떻게 조직되는지, 즉 Oracle 스토리지 계층 구조를 다룬다.

## 4단계 논리 계층

Oracle은 데이터를 논리적으로 **Database → Tablespace → Segment → Extent → Data Block** 순으로 관리한다.

![Oracle 스토리지 논리 계층 구조](/assets/posts/oracle-storage-tablespace-segment-hierarchy.svg)

각 계층은 서로 명확히 구분된 역할을 갖는다.

| 계층 | 물리 대응 | 관리 주체 |
|------|-----------|-----------|
| Database | 데이터 파일 전체 | Instance |
| Tablespace | 1개 이상의 데이터 파일 | DBA |
| Segment | 테이블·인덱스 등 객체 하나 | Oracle |
| Extent | 연속 블록 집합 | Oracle |
| Data Block | OS 파일 블록 | Oracle |

---

## Tablespace

테이블스페이스는 Oracle에서 **공간을 관리하는 최상위 논리 단위**다. 물리적으로는 하나 이상의 데이터 파일(`.dbf`)로 구성된다.

Oracle 설치 시 기본 생성되는 테이블스페이스:

- **SYSTEM**: 딕셔너리(데이터 사전)
- **SYSAUX**: AWR·Statspack 등 보조 데이터
- **USERS**: 일반 사용자 기본 공간
- **TEMP**: 정렬·해시 조인·임시 처리용
- **UNDO**: 롤백과 읽기 일관성용 Undo 데이터

운영 환경에서는 애플리케이션 데이터, 인덱스, 이력 데이터를 **별도 테이블스페이스로 분리**하면 I/O 최적화와 장애 격리에 유리하다.

---

## Locally Managed Tablespace (LMT)와 ASSM

과거 딕셔너리 기반 관리(DMT)는 딕셔너리 테이블에 Extent 정보를 저장해 경합이 심했다. 현재는 **LMT(Locally Managed Tablespace)**가 기본이다. Extent 할당 비트맵을 테이블스페이스 헤더 블록에 직접 저장해 딕셔너리 경합을 제거한다.

ASSM(Automatic Segment Space Management)은 세그먼트 내 블록 가용 공간을 비트맵으로 추적한다. Freelist 경합을 제거해 동시 DML 성능을 높인다.

```sql
-- 테이블스페이스 생성 (LMT + ASSM)
CREATE TABLESPACE app_data
  DATAFILE '/oradata/app_data01.dbf'
  SIZE 500M
  AUTOEXTEND ON NEXT 100M MAXSIZE 10G
  EXTENT MANAGEMENT LOCAL
  SEGMENT SPACE MANAGEMENT AUTO;

-- 사용자 기본 테이블스페이스 지정
ALTER USER app_user DEFAULT TABLESPACE app_data
  TEMPORARY TABLESPACE temp;
```

---

## Segment

**세그먼트**는 테이블, 인덱스, Undo, 임시 세그먼트처럼 단일 데이터베이스 객체에 할당된 스토리지 집합이다. `DBA_SEGMENTS`로 확인할 수 있다.

```sql
-- 상위 10개 세그먼트 크기 조회
SELECT segment_name, segment_type,
       tablespace_name,
       ROUND(bytes / 1048576, 1) AS size_mb
FROM   dba_segments
ORDER  BY bytes DESC
FETCH FIRST 10 ROWS ONLY;
```

테이블 파티셔닝을 사용하면 파티션당 세그먼트가 독립적으로 생성된다. 파티션 프루닝으로 불필요한 세그먼트 접근을 건너뛸 수 있다.

---

## Extent

Extent는 **연속된 데이터 블록의 묶음**으로, 공간 할당의 최소 단위다. Oracle은 세그먼트에 공간이 필요할 때 Extent 단위로 데이터 파일에서 공간을 할당한다.

UNIFORM SIZE를 지정하면 모든 Extent 크기가 동일해 단편화가 줄어든다.

```sql
-- Extent 정보 조회
SELECT segment_name, extent_id, file_id,
       block_id, blocks
FROM   dba_extents
WHERE  segment_name = 'ORDERS'
ORDER  BY extent_id;
```

---

## Data Block

데이터 블록은 Oracle이 데이터를 읽고 쓰는 **최소 I/O 단위**다. 기본 크기는 8KB(`DB_BLOCK_SIZE`)이며, 데이터베이스 생성 시 결정된다. 블록 내부 구조는 다음과 같다.

| 영역 | 설명 |
|------|------|
| Header | 블록 주소(DBA), 세그먼트 유형, SCN |
| Table Directory | 행 데이터를 담은 테이블 목록 |
| Row Directory | 각 행의 오프셋 포인터 |
| Free Space | INSERT·UPDATE를 위한 여유 공간 (PCTFREE) |
| Row Data | 실제 행 데이터 |

```sql
-- 블록 크기 및 파라미터 확인
SELECT name, value
FROM   v$parameter
WHERE  name IN ('db_block_size',
                'db_file_multiblock_read_count');
```

---

## 테이블스페이스 용량 모니터링

![테이블스페이스 관리 DDL 예시](/assets/posts/oracle-storage-tablespace-segment-ddl.svg)

```sql
-- 테이블스페이스별 사용량·잔여 공간
SELECT tablespace_name,
       ROUND(used_space     * 8 / 1024) AS used_mb,
       ROUND(tablespace_size * 8 / 1024) AS total_mb,
       ROUND(used_percent, 1)            AS pct
FROM   dba_tablespace_usage_metrics
ORDER  BY used_percent DESC;
```

90% 이상이면 데이터 파일 추가 또는 AUTOEXTEND를 검토해야 한다.

---

## 설계 체크리스트

- 운영 데이터·인덱스·이력 데이터를 **테이블스페이스 단위로 분리**한다.
- UNDO 테이블스페이스 크기를 과소 설계하면 `ORA-01555: snapshot too old` 오류가 발생한다. `UNDO_RETENTION` 값과 실제 Undo 사용량을 주기적으로 확인하라.
- TEMP 테이블스페이스가 부족하면 대형 정렬·해시 조인이 실패한다.
- `DB_BLOCK_SIZE`는 **OLTP는 8KB, DW는 16KB~32KB**가 일반적이다.

---

**지난 글:** [Oracle 백그라운드 프로세스](/posts/oracle-background-processes/)

**다음 글:** [Oracle Redo·Undo·플래시백](/posts/oracle-redo-undo-flashback/)

<br>
읽어주셔서 감사합니다. 😊
