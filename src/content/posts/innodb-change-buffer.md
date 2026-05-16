---
title: "InnoDB Change Buffer — Secondary Index 쓰기 최적화"
description: "InnoDB Change Buffer가 Non-unique Secondary Index 쓰기를 지연시켜 랜덤 I/O를 줄이는 원리, 적용 조건, 설정 파라미터, 그리고 SSD 환경에서의 의미를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 18
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "change-buffer", "secondary-index", "랜덤I/O", "쓰기최적화"]
featured: false
draft: false
---

[지난 글](/posts/innodb-adaptive-hash-index/)에서 InnoDB가 반복적인 B+Tree 탐색을 해시로 단축하는 AHI를 살펴봤습니다. 이번에는 쓰기 성능을 최적화하는 **Change Buffer**를 다룹니다. Change Buffer의 핵심 아이디어는 간단합니다. Secondary Index 페이지가 Buffer Pool에 없을 때, 디스크에서 즉시 읽어 수정하는 대신, 변경 내역을 먼저 메모리에 저장해두고 나중에 일괄 처리합니다.

## 왜 Secondary Index 쓰기가 비싼가

InnoDB의 Clustered Index(Primary Key)는 데이터를 PK 순으로 정렬해 저장합니다. PK 순서로 INSERT하면 순차 I/O로 빠릅니다. 그러나 **Secondary Index는 별도의 B+Tree**를 유지합니다. Secondary Index의 정렬 순서는 PK와 다르므로, 동일 PK 범위의 INSERT라도 Secondary Index 페이지는 여기저기 랜덤하게 분산됩니다.

예를 들어 `users` 테이블의 `email` 인덱스가 있다면, `user_id` 순서로 INSERT해도 `email` 인덱스 페이지는 알파벳 순서에 따라 랜덤 위치에 씁니다. 각 INSERT마다 해당 인덱스 페이지를 디스크에서 불러와야 합니다. 이것이 **랜덤 I/O**이고 HDD 환경에서는 병목이 됩니다.

## Change Buffer의 작동 방식

![Change Buffer — Secondary Index 쓰기 최적화](/assets/posts/innodb-change-buffer-flow.svg)

1. **변경 감지**: Non-unique Secondary Index 페이지가 Buffer Pool에 없는 상태에서 INSERT/UPDATE/DELETE 발생
2. **Change Buffer 저장**: 실제 인덱스 페이지를 읽지 않고, 변경 내역을 Change Buffer(ibdata1 내 특정 영역)에 저장
3. **즉시 응답**: 클라이언트에 성공을 반환. 디스크 I/O 없음
4. **비동기 Merge**: 다음 중 한 상황이 되면 Change Buffer와 실제 인덱스 페이지를 병합(Merge)
   - 해당 인덱스 페이지를 SELECT 쿼리가 읽을 때
   - InnoDB 백그라운드 스레드가 유휴 시간에 처리할 때
   - 서버 종료 시 플러시

## 적용 조건

Change Buffer가 적용되려면 두 가지 조건이 모두 충족돼야 합니다.

```sql
-- 1. Non-unique Secondary Index만 대상
-- Unique Index는 중복 체크를 위해 페이지를 바로 읽어야 함
CREATE TABLE orders (
    id        BIGINT AUTO_INCREMENT PRIMARY KEY,   -- Clustered Index, Buffer 대상 아님
    user_id   INT NOT NULL,
    status    VARCHAR(20),
    INDEX idx_user (user_id),                     -- Non-unique → Change Buffer 대상
    UNIQUE KEY uk_code (order_code)               -- Unique → 즉시 페이지 로드 필요
);

-- 2. 인덱스 페이지가 Buffer Pool에 없을 때
-- 이미 메모리에 있으면 바로 수정 (Change Buffer 불필요)
```

## 설정과 모니터링

![Change Buffer 설정과 모니터링](/assets/posts/innodb-change-buffer-config.svg)

```sql
-- 활성화 범위 (기본: all)
SHOW VARIABLES LIKE 'innodb_change_buffering';
-- all:    모든 DML (inserts, deletes, purges, changes)
-- inserts: INSERT만
-- none:   비활성화

-- Buffer Pool 내 최대 점유 비율 (기본 25%)
SHOW VARIABLES LIKE 'innodb_change_buffer_max_size';

-- Change Buffer 통계
SHOW STATUS LIKE 'Innodb_ibuf%';
-- Innodb_ibuf_merges:      지금까지 수행된 병합 횟수
-- Innodb_ibuf_merged_inserts: 병합된 INSERT 수
-- Innodb_ibuf_merged_deletes: 병합된 DELETE 마크 수
-- Innodb_ibuf_merged_delete_marks: 병합된 DELETE 처리 수
-- Innodb_ibuf_size:         Change Buffer 현재 크기(페이지)

-- INNODB STATUS에서 상세 확인
SHOW ENGINE INNODB STATUS\G
-- INSERT BUFFER AND ADAPTIVE HASH INDEX 섹션
-- "Ibuf: size 1, free list len X, seg size Y"
```

## SSD 환경에서의 의미

Change Buffer는 HDD 시대에 설계된 최적화입니다. HDD에서는 랜덤 I/O 비용이 극적으로 높아 Change Buffer의 효과가 뚜렷했습니다. NVMe SSD에서는 랜덤 I/O 비용이 크게 낮아, Change Buffer의 이점이 상대적으로 줄었습니다.

실제로 고성능 SSD 서버에서는 `innodb_change_buffering = none`으로 설정하고 더 큰 Buffer Pool을 확보하는 것이 유리할 수 있습니다.

반면 여전히 HDD나 고회전 I/O 스토리지를 사용하는 환경, 또는 Secondary Index가 많고 쓰기가 빈번한 워크로드에서는 Change Buffer가 여전히 유효한 최적화입니다.

## 주의: 서버 종료 지연

Change Buffer에 적체된 변경이 많으면 **MySQL 서버 종료 시 플러시(Merge) 시간이 길어집니다**. 종료가 몇 분씩 걸린다면 Change Buffer 적체를 의심할 수 있습니다.

```sql
-- 긴급 종료 전 Change Buffer 강제 병합
SET GLOBAL innodb_fast_shutdown = 0; -- 완전 플러시 후 종료
-- 0: 완전 병합 후 종료 (느리지만 안전)
-- 1: 빠른 종료 (기본값, 병합 생략)
-- 2: 충돌처럼 즉시 종료 (복구 필요)
```

---

**지난 글:** [InnoDB Adaptive Hash Index — 자동으로 만들어지는 해시 인덱스](/posts/innodb-adaptive-hash-index/)

**다음 글:** [MySQL InnoDB MVCC — 버전 체인과 ReadView](/posts/mysql-innodb-mvcc/)

<br>
읽어주셔서 감사합니다. 😊
