---
title: "Oracle Interval 파티셔닝"
description: "Oracle Interval 파티셔닝이 Range와 어떻게 다른지, 자동 파티션 생성 메커니즘, 관리 전략, 그리고 실무에서 자주 발생하는 주의사항을 실전 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["oracle", "partitioning", "interval-partitioning", "range-partition", "auto-partition", "numtoyminterval", "partition-management"]
featured: false
draft: false
---

[지난 글](/posts/oracle-partitioning-range-list-hash/)에서 Range·List·Hash 파티셔닝의 기초를 다뤘다. Range 파티셔닝의 가장 불편한 점은 새 기간이 올 때마다 수동으로 파티션을 추가해야 한다는 것이다. **Interval 파티셔닝**은 이 문제를 해결한다.

## Interval 파티셔닝이란

Oracle 11g에서 도입된 Interval 파티셔닝은 Range 파티셔닝의 확장이다. 기준 파티션을 하나만 정의해두고, 이후 INSERT되는 데이터가 해당 범위를 벗어나면 **Oracle이 자동으로 새 파티션을 생성**한다. 월별 로그 테이블에 12월 데이터가 들어오면, 아직 12월 파티션이 없어도 그냥 INSERT하면 된다.

![Interval 파티셔닝 자동 파티션 생성](/assets/posts/oracle-interval-partitioning-auto.svg)

## 기본 구문

```sql
CREATE TABLE log_tbl (
  log_id  NUMBER        GENERATED ALWAYS AS IDENTITY,
  log_dt  DATE          NOT NULL,
  svc_nm  VARCHAR2(50),
  msg     VARCHAR2(500)
)
PARTITION BY RANGE (log_dt)
INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'))
STORE IN (tbs_logs)
(
  PARTITION p_before_2024
    VALUES LESS THAN (DATE '2024-01-01')
);
```

핵심 키워드는 `INTERVAL`이다. `NUMTOYMINTERVAL(1, 'MONTH')`는 "1개월 간격"을 의미하며, `NUMTODSINTERVAL(1, 'DAY')`는 일별, `NUMTOYMINTERVAL(1, 'YEAR')`는 연별이다.

기준 파티션(`p_before_2024`)은 반드시 하나 이상 있어야 한다. 이 파티션이 Interval의 시작점 역할을 한다.

![Interval 파티셔닝 DDL 패턴](/assets/posts/oracle-interval-partitioning-syntax.svg)

## 자동 생성 파티션의 이름

Oracle이 자동으로 만드는 파티션 이름은 `SYS_P숫자` 형식이다. DBA 입장에서는 직관적이지 않으므로, 생성 후 의미 있는 이름으로 변경하는 것이 관리에 유리하다.

```sql
-- 자동 생성된 파티션 목록 확인
SELECT partition_name,
       high_value,
       num_rows
FROM   user_tab_partitions
WHERE  table_name = 'LOG_TBL'
ORDER BY partition_position;

-- 이름 변경
ALTER TABLE log_tbl
  RENAME PARTITION SYS_P001 TO p2024_jan;

ALTER TABLE log_tbl
  RENAME PARTITION SYS_P002 TO p2024_feb;
```

이름 변경은 DML에 영향을 주지 않는다. 단, 스크립트에서 파티션 이름을 직접 참조하는 경우(예: `PARTITION(p_jan)`)에는 변경 전 이름을 확인해야 한다.

## 파티션별 인덱스와 Interval

Interval 파티션 테이블에서도 **로컬 인덱스**를 권장한다. 새 파티션이 생성될 때 로컬 인덱스 파티션도 자동으로 함께 생성된다.

```sql
-- 로컬 인덱스: 파티션 자동 확장에 맞춰 자동 생성
CREATE INDEX idx_log_dt
  ON log_tbl (log_dt) LOCAL;

-- 글로벌 인덱스: 파티션 DROP 후 UNUSABLE 상태가 됨
CREATE INDEX idx_log_svc
  ON log_tbl (svc_nm) GLOBAL;
```

오래된 파티션을 DROP할 때 글로벌 인덱스를 함께 처리하려면 `UPDATE GLOBAL INDEXES` 옵션을 쓴다. 다만 이 옵션은 DROP 시간이 더 걸린다.

```sql
ALTER TABLE log_tbl
  DROP PARTITION p2024_jan
  UPDATE GLOBAL INDEXES;
```

## 이력 파티션 자동 삭제 패턴

Interval 파티셔닝은 생성은 자동이지만 삭제는 여전히 수동이다. DBMS_SCHEDULER와 조합하면 오래된 파티션을 자동으로 정리할 수 있다.

```sql
-- 3개월 이상 된 파티션 자동 삭제 프로시저
CREATE OR REPLACE PROCEDURE purge_old_partitions
IS
BEGIN
  FOR r IN (
    SELECT partition_name
    FROM   user_tab_partitions
    WHERE  table_name = 'LOG_TBL'
      AND  high_value < SYSTIMESTAMP - INTERVAL '90' DAY
  ) LOOP
    EXECUTE IMMEDIATE
      'ALTER TABLE log_tbl DROP PARTITION ' || r.partition_name;
  END LOOP;
END;
/

-- 스케줄러 등록 (매일 새벽 2시)
BEGIN
  DBMS_SCHEDULER.CREATE_JOB(
    job_name   => 'JOB_PURGE_PARTITIONS',
    job_type   => 'STORED_PROCEDURE',
    job_action => 'PURGE_OLD_PARTITIONS',
    repeat_interval => 'FREQ=DAILY; BYHOUR=2; BYMINUTE=0',
    enabled    => TRUE
  );
END;
/
```

`high_value`가 문자열로 저장되어 있어 직접 비교가 안 된다. 실무에서는 `DBMS_STATS.CONVERT_RAW_VALUE` 또는 `XMLTYPE`을 이용해 파싱하거나, PARTITION_POSITION을 기준으로 삭제 대상을 선별하는 방법을 쓰기도 한다.

## 주의사항

**1. MAXVALUE 파티션 불가**: Interval 파티션 테이블에는 `VALUES LESS THAN (MAXVALUE)` 파티션을 추가할 수 없다. 대신 Interval이 그 역할을 대신한다.

**2. NULL 값 처리**: 파티션 키 컬럼이 NULL이면 어느 파티션에도 들어가지 않아 에러가 발생한다. `NOT NULL` 제약 또는 INSERT 전처리 필수다.

**3. 파티션 기준 컬럼 수정**: 기존 Range → Interval 전환은 `ALTER TABLE ... SET INTERVAL`로 가능하다 (11g+).

```sql
-- 기존 Range 테이블에 Interval 적용
ALTER TABLE sales
  SET INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'));
```

**4. 트랜잭션 내 자동 파티션 생성**: 자동 생성은 DDL이므로 묵시적 COMMIT이 발생한다. 롤백 시나리오에서 예상치 못한 파티션이 남을 수 있다.

## 정리

- Range 파티셔닝의 수동 관리 부담을 제거하는 것이 Interval의 핵심 가치
- `INTERVAL(NUMTOYMINTERVAL(1,'MONTH'))` — 가장 흔한 월별 패턴
- 자동 생성 파티션 이름(`SYS_P*`)은 RENAME으로 정리 권장
- 로컬 인덱스와 조합 시 파티션 확장·삭제가 가장 깔끔하게 동작
- NULL 방지와 파티션 삭제 자동화는 별도 설계 필요

---

**지난 글:** [Oracle 파티셔닝: Range·List·Hash](/posts/oracle-partitioning-range-list-hash/)

**다음 글:** [파티션-와이즈 조인](/posts/oracle-partition-wise-join/)

<br>
읽어주셔서 감사합니다. 😊
