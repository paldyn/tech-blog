---
title: "MySQL 스토어드 프로시저와 함수 — 서버 사이드 로직 구현"
description: "MySQL 스토어드 프로시저와 스토어드 함수의 차이, 파라미터 모드(IN/OUT/INOUT), 제어 흐름(IF/LOOP/CURSOR), 예외 처리, DETERMINISTIC 선언의 의미를 실전 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 36
type: "knowledge"
category: "SQL"
tags: ["mysql", "stored-procedure", "stored-function", "delimiter", "cursor", "exception-handler", "서버사이드로직"]
featured: false
draft: false
---

[지난 글](/posts/mysql-derived-merge/)에서 파생 테이블 병합 최적화를 살펴봤습니다. 이번 글에서는 MySQL에서 복잡한 비즈니스 로직을 서버에 저장해 재사용하는 **스토어드 루틴(프로시저·함수)**을 다룹니다.

## 스토어드 루틴이란

스토어드 루틴은 SQL과 절차적 로직을 묶어 데이터베이스 서버에 저장해 두고 이름으로 호출하는 코드 단위입니다. 애플리케이션이 매번 SQL을 전송하는 대신 `CALL proc_name(args)` 하나로 복잡한 처리를 서버에서 완결할 수 있습니다.

```sql
-- 루틴 목록 확인
SHOW PROCEDURE STATUS WHERE Db = 'mydb';
SHOW FUNCTION STATUS WHERE Db = 'mydb';

-- 루틴 정의 확인
SHOW CREATE PROCEDURE transfer_points\G
SHOW CREATE FUNCTION tier_label\G
```

## DELIMITER 설정

MySQL 클라이언트는 `;`을 명령 구분자로 사용합니다. 루틴 본문에도 `;`이 있으므로 구분자를 임시 변경해야 합니다.

```sql
DELIMITER //

CREATE PROCEDURE my_proc()
BEGIN
  SELECT 1;  -- 이 ; 는 명령 끝이 아님
END //

DELIMITER ;
```

`//` 외에 `$$`를 쓰기도 합니다. 루틴 정의가 끝나면 반드시 원래 `;`로 복원합니다.

## 프로시저 vs 함수

![프로시저와 함수 비교](/assets/posts/mysql-stored-procedure-function-compare.svg)

두 가지의 결정적 차이는 **반환 방식**과 **DML 허용 여부**입니다. 프로시저는 `INSERT`, `UPDATE`, `DELETE`, 트랜잭션 제어까지 모두 가능하고, `CALL`로 호출합니다. 함수는 `SELECT` 식 어디서나 사용할 수 있는 단일 스칼라값을 반환하지만 DML은 기본적으로 금지됩니다.

## 파라미터 모드 (프로시저)

```sql
DELIMITER //
CREATE PROCEDURE calc_discount(
  IN  p_price    DECIMAL(10,2),   -- 호출자→루틴 (읽기 전용)
  IN  p_rate     DECIMAL(5,2),
  OUT p_discount DECIMAL(10,2),   -- 루틴→호출자 (반환)
  INOUT p_total  DECIMAL(10,2)    -- 양방향
)
BEGIN
  SET p_discount = p_price * p_rate / 100;
  SET p_total    = p_total - p_discount;
END //
DELIMITER ;

-- 호출
SET @total = 50000;
CALL calc_discount(50000, 10.0, @disc, @total);
SELECT @disc, @total;
```

`OUT`/`INOUT` 인수는 반드시 사용자 변수(`@이름`)로 전달합니다.

## 스토어드 함수 — DETERMINISTIC 선언

![프로시저·함수 코드 예시](/assets/posts/mysql-stored-procedure-function-code.svg)

```sql
DELIMITER //
CREATE FUNCTION vat_amount(price DECIMAL(10,2))
RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
  RETURN price * 0.10;
END //
DELIMITER ;

-- WHERE 절에서도 직접 사용 가능
SELECT id, price, vat_amount(price) vat
FROM products
WHERE vat_amount(price) > 5000;
```

`DETERMINISTIC`은 같은 입력에 항상 같은 결과를 반환함을 선언합니다. 바이너리 로그 복제 환경에서 함수가 `DETERMINISTIC`이 아니면 MySQL이 복제 안전성 문제로 에러를 냅니다(`log_bin_trust_function_creators` 설정으로 우회 가능하지만 권장하지 않음).

## 제어 흐름

```sql
-- IF / ELSEIF / ELSE
IF p_score >= 90 THEN
  SET v_grade = 'A';
ELSEIF p_score >= 80 THEN
  SET v_grade = 'B';
ELSE
  SET v_grade = 'F';
END IF;

-- WHILE 루프
SET i = 1;
WHILE i <= 10 DO
  INSERT INTO log_table VALUES (i, NOW());
  SET i = i + 1;
END WHILE;

-- LOOP + LEAVE (break)
my_loop: LOOP
  FETCH cur INTO v_id;
  IF done THEN LEAVE my_loop; END IF;
END LOOP my_loop;
```

## 커서 — 결과셋 행 단위 처리

```sql
DELIMITER //
CREATE PROCEDURE process_overdue()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_id INT;
  DECLARE v_amount DECIMAL(10,2);

  DECLARE cur CURSOR FOR
    SELECT id, amount FROM orders WHERE due_date < CURDATE();
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  row_loop: LOOP
    FETCH cur INTO v_id, v_amount;
    IF done THEN LEAVE row_loop; END IF;
    UPDATE orders SET penalty = v_amount * 0.05 WHERE id = v_id;
  END LOOP row_loop;
  CLOSE cur;
END //
DELIMITER ;
```

커서 루프는 행 단위 처리라 대량 데이터에는 느립니다. 가능하면 `UPDATE ... JOIN` 등 집합 기반 쿼리로 대체합니다.

## 예외 처리 — HANDLER

```sql
DELIMITER //
CREATE PROCEDURE safe_insert(IN p_id INT, IN p_name VARCHAR(50))
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '삽입 실패';
  END;

  START TRANSACTION;
  INSERT INTO members (id, name) VALUES (p_id, p_name);
  COMMIT;
END //
DELIMITER ;
```

`EXIT HANDLER`는 예외 발생 시 루틴을 종료합니다. `CONTINUE HANDLER`는 예외 발생 후 다음 문장을 계속 실행합니다.

## 루틴 관리

```sql
-- 수정: DROP 후 재생성 (ALTER는 속성만 변경)
DROP PROCEDURE IF EXISTS transfer_points;

-- 권한 부여 (특정 루틴만 실행 허용)
GRANT EXECUTE ON PROCEDURE mydb.transfer_points TO 'appuser'@'%';
GRANT EXECUTE ON FUNCTION  mydb.tier_label TO 'appuser'@'%';
```

스토어드 루틴은 비즈니스 로직 중 **변경 빈도가 낮고**, **여러 애플리케이션이 공유**하며, **트랜잭션이 포함된** 작업에 적합합니다. 로직이 자주 바뀌거나 애플리케이션 단 테스트가 필요하다면 애플리케이션 레이어에 두는 것이 더 유연합니다.

---

**지난 글:** [MySQL Derived Table Merge — 파생 테이블 병합 최적화](/posts/mysql-derived-merge/)

**다음 글:** [MySQL 트리거 — 자동 감사와 무결성 보호](/posts/mysql-trigger/)

<br>
읽어주셔서 감사합니다. 😊
