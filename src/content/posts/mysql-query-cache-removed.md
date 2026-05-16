---
title: "MySQL 쿼리 캐시가 사라진 이유 — 글로벌 Mutex의 함정"
description: "MySQL 쿼리 캐시가 5.7에서 Deprecated되고 8.0에서 완전히 제거된 이유를 글로벌 Mutex 병목과 캐시 무효화 문제로 설명하고, 실무에서 사용할 수 있는 대안을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 12
type: "knowledge"
category: "SQL"
tags: ["mysql", "쿼리캐시", "query-cache", "global-mutex", "redis", "mysql8"]
featured: false
draft: false
---

[지난 글](/posts/mysql-connection-thread-model/)에서 MySQL의 Thread-per-Connection 모델과 커넥션 풀 설계를 살펴봤습니다. 이번 글에서는 MySQL의 가장 논란 많은 기능 중 하나였던 **쿼리 캐시(Query Cache)** 를 다룹니다. MySQL 5.7에서 Deprecated, 8.0에서 완전 제거됐습니다. 왜 "캐시"가 오히려 성능을 망쳤을까요?

## 쿼리 캐시란 무엇인가

쿼리 캐시는 SELECT 쿼리 텍스트와 그 결과를 메모리에 저장해두는 기능입니다. 동일한 쿼리 문자열이 다시 들어오면 실제 실행 없이 캐시에서 바로 결과를 돌려줍니다.

```sql
-- 쿼리 캐시 활성화 (5.7 이하)
SET GLOBAL query_cache_type = 1;      -- ON
SET GLOBAL query_cache_size = 67108864; -- 64MB

-- 캐시 상태 확인
SHOW STATUS LIKE 'Qcache%';
-- Qcache_hits:      캐시 적중 횟수
-- Qcache_inserts:   캐시 삽입 횟수
-- Qcache_not_cached: 캐시 불가 쿼리 수
-- Qcache_lowmem_prunes: 메모리 부족으로 삭제된 항목 수

-- 특정 쿼리를 캐시에서 제외
SELECT SQL_NO_CACHE * FROM orders WHERE status = 'pending';
```

이론적으로는 매력적입니다. 반복적인 읽기 쿼리가 많은 워크로드에서는 효과가 있었습니다. 그러나 실제 프로덕션 환경에서 치명적인 문제가 드러났습니다.

## 글로벌 Mutex 문제

쿼리 캐시의 핵심 문제는 **단 하나의 Global Mutex**로 전체 캐시를 보호한다는 점입니다.

![쿼리 캐시 — 글로벌 Mutex 병목](/assets/posts/mysql-query-cache-removed-mutex.svg)

SELECT가 캐시를 읽을 때도, UPDATE가 캐시를 무효화할 때도, 새로운 결과를 캐시에 저장할 때도 모두 이 하나의 Mutex를 획득해야 합니다.

결과는 명확합니다. **동시 연결이 많아질수록 Mutex 경합이 심해져 오히려 처리량이 떨어집니다.** 코어가 많은 현대 서버일수록 더 극적으로 성능이 하락하는 역설이 생깁니다.

```sql
-- 쿼리 캐시 관련 대기 이벤트 확인 (Performance Schema)
SELECT event_name, count_star, sum_timer_wait/1e12 AS wait_sec
FROM   performance_schema.events_waits_summary_global_by_event_name
WHERE  event_name LIKE '%query_cache%'
ORDER BY sum_timer_wait DESC;
```

## 캐시 무효화의 함정

두 번째 문제는 **캐시 무효화 규칙**입니다. MySQL 쿼리 캐시는 테이블 단위로 무효화합니다. `orders` 테이블에 UPDATE 한 건이 발생하면, `orders`를 참조하는 **모든 캐시 항목이 즉시 삭제**됩니다.

```sql
-- 이 UPDATE 한 줄이
UPDATE orders SET status = 'done' WHERE id = 99999;

-- orders를 사용하는 모든 캐시를 날린다
-- SELECT * FROM orders WHERE customer_id = 1; → 캐시 삭제됨
-- SELECT COUNT(*) FROM orders WHERE ...;      → 캐시 삭제됨
-- SELECT o.*, c.name FROM orders o JOIN ...;  → 캐시 삭제됨
```

OLTP 환경에서는 INSERT·UPDATE·DELETE가 끊임없이 발생합니다. 쿼리 캐시는 쌓이자마자 지워지기를 반복하고, Mutex 경합만 늘어납니다. `Qcache_lowmem_prunes`가 크고 `Qcache_hits / (Qcache_hits + Qcache_inserts)`가 낮다면 캐시가 역효과를 내고 있다는 신호입니다.

## 8.0에서 제거된 이유

MySQL 팀이 제거를 결정한 이유는 명확했습니다.

1. **현대 워크로드와 맞지 않음**: 잦은 쓰기, 다양한 쿼리 패턴, 멀티코어 서버 환경에서 쿼리 캐시는 이점보다 손해가 큽니다.
2. **고치기 어려운 구조적 문제**: 단일 Global Mutex를 샤딩하거나 교체하려면 캐시 전체를 재설계해야 합니다.
3. **더 나은 대안 존재**: InnoDB Buffer Pool이 실제 데이터를 캐싱하고, 더 정교한 애플리케이션 레벨 캐시가 가능합니다.

MySQL 5.7에서 `query_cache_type=0`(OFF)이 기본값이 됐고, 8.0 GA(2018)에서 코드 자체가 제거됐습니다.

## 대안 전략

![쿼리 캐시 대안 — 어떻게 대체할 것인가](/assets/posts/mysql-query-cache-removed-alternatives.svg)

### 1. Redis / Memcached

애플리케이션에서 결과를 직접 캐싱합니다. 만료 시간(TTL)을 제어할 수 있고, 비즈니스 로직 단위로 캐싱 범위를 정할 수 있습니다.

```python
import redis, json

r = redis.Redis()

def get_user_stats(user_id):
    cache_key = f"user:stats:{user_id}"
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)

    # DB 조회
    result = db.query("SELECT ... FROM orders WHERE user_id = %s", user_id)
    r.setex(cache_key, 300, json.dumps(result))  # 5분 TTL
    return result
```

### 2. InnoDB Buffer Pool 최적화

쿼리 캐시 없이도 InnoDB Buffer Pool이 자주 사용되는 페이지를 메모리에 유지합니다. Buffer Pool 크기를 여유 있게 설정하는 것만으로도 충분한 경우가 많습니다.

```sql
-- Buffer Pool 상태 확인
SHOW STATUS LIKE 'Innodb_buffer_pool%';
-- Innodb_buffer_pool_read_requests: 논리 읽기
-- Innodb_buffer_pool_reads:          물리 읽기 (디스크 I/O)
-- 적중률 = 1 - (reads / read_requests) → 0.99 이상 권장
```

### 3. ProxySQL 또는 읽기 전용 복제본

쓰기는 Primary, 읽기는 Replica로 분리하면 읽기 부하를 줄이면서도 최신 데이터를 보장할 수 있습니다. ProxySQL을 미들웨어로 두면 쿼리 규칙 기반 라우팅과 캐싱을 함께 처리합니다.

## 정리

쿼리 캐시의 제거는 MySQL이 성숙해지는 과정의 일부입니다. "캐시니까 빠를 것"이라는 직관이 단일 Global Mutex와 만나면 병목이 됩니다. MySQL 8.0 이상에서는 쿼리 캐시를 아예 잊고, 애플리케이션 레벨 캐싱·InnoDB Buffer Pool 튜닝·읽기 전용 레플리카로 설계를 이어가는 것이 올바른 방향입니다.

---

**지난 글:** [MySQL 커넥션과 스레드 모델 — Thread-per-Connection 구조](/posts/mysql-connection-thread-model/)

**다음 글:** [InnoDB 디스크 레이아웃 — 테이블스페이스, 익스텐트, 페이지](/posts/innodb-disk-layout/)

<br>
읽어주셔서 감사합니다. 😊
