---
title: "MySQL 이벤트 스케줄러 — 자동 배치 작업 스케줄링"
description: "MySQL 이벤트 스케줄러로 정기 배치 작업을 DB 내부에서 자동 실행하는 방법, ONE TIME과 RECURRING 스케줄, INTERVAL 단위, ON COMPLETION 옵션, 에러 처리 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 38
type: "knowledge"
category: "SQL"
tags: ["mysql", "event-scheduler", "cron", "scheduled-job", "batch-processing", "recurring-event", "자동배치"]
featured: false
draft: false
---

[지난 글](/posts/mysql-trigger/)에서 DML 이벤트에 반응하는 트리거를 살펴봤습니다. 이번 글에서는 시간 기반으로 자동 실행되는 **이벤트 스케줄러(Event Scheduler)**를 다룹니다. 외부 cron 없이 MySQL 내부에서 정기 배치 작업을 처리할 수 있습니다.

## 이벤트 스케줄러란

이벤트 스케줄러는 MySQL 서버의 백그라운드 스레드가 주기적으로 등록된 이벤트를 확인하고 지정 시점이 되면 자동으로 실행하는 기능입니다. Linux의 `cron`과 비슷하지만 MySQL 데이터베이스 내부에서 동작합니다.

```sql
-- 스케줄러 활성화 상태 확인
SHOW VARIABLES LIKE 'event_scheduler';

-- 활성화 (런타임 변경)
SET GLOBAL event_scheduler = ON;

-- 비활성화
SET GLOBAL event_scheduler = OFF;
```

`event_scheduler=ON`은 서버 재시작 후 초기화됩니다. 영속적으로 활성화하려면 `my.cnf`에 `event_scheduler=ON`을 추가해야 합니다.

## 이벤트 구조

![이벤트 스케줄러 흐름](/assets/posts/mysql-event-scheduler-flow.svg)

이벤트 스케줄러 스레드는 `mysql.event` 테이블을 폴링하다가 실행 시점이 된 이벤트를 임시 커넥션으로 실행합니다. 실행이 완료되면 커넥션이 해제됩니다.

## ONE TIME 이벤트 — 일회성 실행

```sql
-- 특정 시점에 한 번만 실행
CREATE EVENT ev_migrate_2025_data
ON SCHEDULE AT '2026-01-01 02:00:00'
ON COMPLETION NOT PRESERVE  -- 실행 후 자동 삭제 (기본값)
ENABLE
DO
  INSERT INTO orders_archive
  SELECT * FROM orders WHERE YEAR(created_at) = 2025;
```

`ON COMPLETION NOT PRESERVE`(기본값)는 이벤트 실행 후 자동으로 삭제합니다. `PRESERVE`를 쓰면 실행 후에도 이벤트 정의가 남아 있어 나중에 재활성화할 수 있습니다.

## RECURRING 이벤트 — 반복 실행

```sql
CREATE EVENT ev_cleanup_logs
ON SCHEDULE
  EVERY 1 DAY
  STARTS '2026-01-01 00:00:00'
ON COMPLETION PRESERVE
ENABLE
DO
  DELETE FROM access_logs
  WHERE logged_at < NOW() - INTERVAL 90 DAY;
```

`EVERY` 뒤에 숫자와 단위를 지정합니다.

```sql
-- 다양한 INTERVAL 예시
EVERY 30 MINUTE
EVERY 6 HOUR
EVERY 1 WEEK
EVERY 1 MONTH
EVERY 3 MONTH   -- 분기

-- STARTS / ENDS 범위 지정
ON SCHEDULE EVERY 1 HOUR
  STARTS CURRENT_TIMESTAMP
  ENDS '2026-12-31 23:59:59'
```

## 복합 로직 — BEGIN...END

이벤트 본문에 복잡한 로직이 필요하면 `BEGIN...END` 블록을 사용합니다.

```sql
DELIMITER //
CREATE EVENT ev_daily_stats
ON SCHEDULE EVERY 1 DAY
STARTS (CURRENT_DATE + INTERVAL 1 DAY + INTERVAL 1 HOUR)
ON COMPLETION PRESERVE
ENABLE
DO
BEGIN
  -- 통계 테이블 갱신
  INSERT INTO daily_summary (date, total_orders, total_revenue)
  SELECT
    CURDATE() - INTERVAL 1 DAY,
    COUNT(*),
    SUM(amount)
  FROM orders
  WHERE DATE(created_at) = CURDATE() - INTERVAL 1 DAY
  ON DUPLICATE KEY UPDATE
    total_orders   = VALUES(total_orders),
    total_revenue  = VALUES(total_revenue);

  -- 오래된 임시 데이터 정리
  DELETE FROM temp_sessions
  WHERE expired_at < NOW();
END //
DELIMITER ;
```

## 이벤트 관리

![이벤트 관리 명령](/assets/posts/mysql-event-scheduler-code.svg)

```sql
-- 이벤트 목록 조회
SELECT
  EVENT_NAME,
  STATUS,
  LAST_EXECUTED,
  NEXT_EXECUTION,
  EVENT_DEFINITION
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = 'mydb';

-- 이벤트 일시 중지
ALTER EVENT ev_cleanup_logs DISABLE;

-- 재활성화
ALTER EVENT ev_cleanup_logs ENABLE;

-- 스케줄 변경
ALTER EVENT ev_cleanup_logs
ON SCHEDULE EVERY 12 HOUR;

-- 삭제
DROP EVENT IF EXISTS ev_cleanup_logs;
```

## 에러 처리 — 자체 로그 기록

이벤트 내 에러는 MySQL 일반 에러 로그에 기록되지만, 에러 발생 시 이벤트가 자동 비활성화되지는 않습니다. 이벤트 실행 이력을 추적하려면 직접 로그 테이블을 사용합니다.

```sql
DELIMITER //
CREATE EVENT ev_safe_cleanup
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
  DECLARE v_err_msg VARCHAR(500);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1
      v_err_msg = MESSAGE_TEXT;
    INSERT INTO event_log (event_name, status, message, executed_at)
    VALUES ('ev_safe_cleanup', 'ERROR', v_err_msg, NOW());
  END;

  -- 메인 로직
  DELETE FROM temp_data WHERE created_at < NOW() - INTERVAL 7 DAY;

  -- 성공 로그
  INSERT INTO event_log (event_name, status, message, executed_at)
  VALUES ('ev_safe_cleanup', 'OK', 'completed', NOW());
END //
DELIMITER ;
```

## 타임존 주의사항

이벤트는 **서버 타임존** 기준으로 실행됩니다.

```sql
-- 서버 타임존 확인
SHOW VARIABLES LIKE 'system_time_zone';
SHOW VARIABLES LIKE 'time_zone';

-- KST 서버에서 UTC 기준 자정 실행이 필요하면
ON SCHEDULE EVERY 1 DAY
STARTS '2026-01-01 09:00:00'  -- KST 09:00 = UTC 00:00
```

## 이벤트 vs cron

| 항목 | MySQL 이벤트 | OS cron |
|---|---|---|
| DB 접근 | 네이티브, 커넥션 비용 없음 | 별도 커넥션 필요 |
| 에러 복구 | 자동 재시작 없음 | 재시도 구현 필요 |
| 복잡한 로직 | BEGIN...END 가능 | 외부 스크립트 |
| 모니터링 | INFORMATION_SCHEMA | 시스템 도구 |
| 복제 환경 | 주의 필요 (레플리카에서도 실행) | 독립적 제어 |

복제 환경에서는 레플리카에서 이벤트가 중복 실행되지 않도록 레플리카의 `event_scheduler=OFF` 설정이 필요합니다.

---

**지난 글:** [MySQL 트리거 — 자동 감사와 무결성 보호](/posts/mysql-trigger/)

**다음 글:** [MySQL JSON 타입과 가상 컬럼 — 반정형 데이터 처리](/posts/mysql-json-virtual-column/)

<br>
읽어주셔서 감사합니다. 😊
