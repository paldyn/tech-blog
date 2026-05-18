---
title: "MySQL 트리거 — 자동 감사와 무결성 보호"
description: "MySQL 트리거의 BEFORE/AFTER 타이밍, OLD/NEW 레퍼런스, 감사 로그·값 검증 패턴, 트리거 제약 사항과 성능 영향을 실전 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 37
type: "knowledge"
category: "SQL"
tags: ["mysql", "trigger", "before-after", "old-new", "audit-log", "signal", "무결성보호"]
featured: false
draft: false
---

[지난 글](/posts/mysql-stored-procedure-function/)에서 스토어드 프로시저와 함수로 서버 사이드 로직을 구현하는 방법을 살펴봤습니다. 이번 글에서는 DML 이벤트에 자동으로 반응하는 **트리거(Trigger)**를 다룹니다.

## 트리거란

트리거는 `INSERT`, `UPDATE`, `DELETE` 이벤트가 발생할 때 **자동으로 실행**되는 코드입니다. 애플리케이션 코드 없이도 데이터 변경 이력을 기록하거나, 잘못된 값을 거부하거나, 파생 데이터를 자동으로 유지할 수 있습니다.

```sql
-- 트리거 목록 확인
SHOW TRIGGERS FROM mydb;

-- 특정 테이블의 트리거 확인
SELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_TIMING
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE EVENT_OBJECT_TABLE = 'orders'
  AND TRIGGER_SCHEMA = 'mydb';
```

## BEFORE vs AFTER

![트리거 실행 타이밍](/assets/posts/mysql-trigger-timing.svg)

**BEFORE 트리거**는 행이 변경되기 전에 실행됩니다. `NEW` 값을 수정하거나 `SIGNAL`로 변경을 거부할 수 있습니다.

**AFTER 트리거**는 행 변경이 완료된 후 실행됩니다. 변경을 되돌릴 수 없으므로 감사 로그 기록이나 다른 테이블 업데이트에 사용합니다.

## BEFORE INSERT — 값 검증과 자동 설정

![트리거 코드 예시](/assets/posts/mysql-trigger-code.svg)

```sql
DELIMITER //
CREATE TRIGGER trg_order_before_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
  -- 음수 금액 거부
  IF NEW.amount < 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '주문 금액은 0 이상이어야 합니다';
  END IF;

  -- 기본값 자동 설정 (DEFAULT로 처리 안 되는 경우)
  IF NEW.status IS NULL THEN
    SET NEW.status = 'pending';
  END IF;
END //
DELIMITER ;
```

`SIGNAL SQLSTATE '45000'`은 사용자 정의 예외를 발생시켜 DML을 취소합니다. `45000`은 사용자 정의 예외에 사용하는 표준 SQLSTATE입니다.

## AFTER UPDATE — 감사 로그

```sql
DELIMITER //
CREATE TRIGGER trg_members_audit
AFTER UPDATE ON members
FOR EACH ROW
BEGIN
  IF NEW.points <> OLD.points THEN
    INSERT INTO member_audit
      (member_id, old_points, new_points, changed_by, changed_at)
    VALUES
      (NEW.id, OLD.points, NEW.points, USER(), NOW());
  END IF;
END //
DELIMITER ;
```

`OLD`는 변경 전 값, `NEW`는 변경 후 값입니다. `OLD`는 UPDATE와 DELETE에서, `NEW`는 INSERT와 UPDATE에서 사용합니다.

## AFTER DELETE — 소프트 아카이브

```sql
DELIMITER //
CREATE TRIGGER trg_orders_archive
AFTER DELETE ON orders
FOR EACH ROW
BEGIN
  INSERT INTO orders_archive
    (id, customer_id, amount, status, deleted_at)
  VALUES
    (OLD.id, OLD.customer_id, OLD.amount, OLD.status, NOW());
END //
DELIMITER ;
```

물리적으로 삭제된 데이터를 자동으로 아카이브 테이블로 이동합니다.

## OLD / NEW 가용성 정리

| 이벤트 | OLD | NEW |
|---|---|---|
| INSERT | ✗ 없음 | ✓ |
| UPDATE | ✓ | ✓ |
| DELETE | ✓ | ✗ 없음 |

## 트리거 제약 사항

```sql
-- 금지: 트리거 내에서 COMMIT / ROLLBACK
-- (트리거는 호출한 트랜잭션의 일부)

-- 금지: 트리거가 자신의 테이블을 직접 수정
-- (무한 루프 위험)

-- 8.0.2+ 이전: 같은 이벤트에 트리거 하나뿐
-- 8.0.2+: 여러 트리거 가능, 순서는 FOLLOWS / PRECEDES로 지정
```

## 여러 트리거 순서 지정 (8.0.2+)

```sql
CREATE TRIGGER trg_orders_check
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
  -- 첫 번째 BEFORE INSERT 트리거
END;

-- 기존 트리거 이후에 실행
CREATE TRIGGER trg_orders_notify
BEFORE INSERT ON orders
FOR EACH ROW
FOLLOWS trg_orders_check
BEGIN
  -- 두 번째 BEFORE INSERT 트리거
END;
```

## 트리거 관리

```sql
-- 트리거 삭제
DROP TRIGGER IF EXISTS mydb.trg_members_audit;

-- 트리거는 ALTER 불가 → DROP 후 재생성
DROP TRIGGER IF EXISTS trg_orders_archive;
CREATE TRIGGER trg_orders_archive ...;
```

## 성능과 주의사항

트리거는 매 행마다 실행됩니다. `INSERT INTO orders ... SELECT ...` 같은 대량 INSERT에서는 트리거도 행 수만큼 실행되므로 성능 저하가 발생할 수 있습니다.

```sql
-- 대량 데이터 로딩 시 트리거 임시 비활성화 (5.6 이전 방식)
SET @OLD_SQL_LOG_BIN = @@SQL_LOG_BIN;
-- 또는 DISABLE TRIGGER 는 MySQL에서 미지원
-- 대안: 트리거 DROP 후 로딩, 재생성
```

트리거는 **숨겨진 로직**이므로 유지보수 시 DML만 보고 트리거 효과를 놓치기 쉽습니다. 트리거를 사용할 때는 반드시 `INFORMATION_SCHEMA.TRIGGERS` 조회를 습관화하고, 팀 문서에 명시해야 합니다.

---

**지난 글:** [MySQL 스토어드 프로시저와 함수 — 서버 사이드 로직 구현](/posts/mysql-stored-procedure-function/)

**다음 글:** [MySQL 이벤트 스케줄러 — 자동 배치 작업 스케줄링](/posts/mysql-event-scheduler/)

<br>
읽어주셔서 감사합니다. 😊
