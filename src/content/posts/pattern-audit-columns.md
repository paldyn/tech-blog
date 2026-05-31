---
title: "감사 컬럼 패턴 — created_at, updated_at, created_by"
description: "거의 모든 테이블에 추가해야 하는 감사 컬럼(Audit Columns)의 설계 원칙을 설명합니다. created_at·updated_at 타임스탬프, created_by·updated_by 작업자 추적, version 컬럼을 이용한 낙관적 잠금, 그리고 트리거와 ORM으로 자동화하는 방법을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["감사 컬럼", "타임스탬프", "낙관적 잠금", "데이터 모델링", "트리거"]
featured: false
draft: false
---

[지난 글](/posts/pattern-soft-delete-vs-hard-delete/)에서 논리 삭제 패턴을 다뤘습니다. 삭제와 마찬가지로 "언제, 누가, 어떻게 바꿨는지"를 추적하는 것은 모든 비즈니스 데이터에서 필수입니다. **감사 컬럼(Audit Columns)** 패턴은 이 정보를 테이블 자체에 내장합니다.

## 기본 감사 컬럼 4종

모든 비즈니스 테이블에 추가하는 기본 감사 컬럼입니다.

```sql
-- 기본 감사 컬럼 세트
CREATE TABLE orders (
  id          BIGSERIAL PRIMARY KEY,
  -- 비즈니스 컬럼들...
  amount      NUMERIC(12, 2) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- 감사 컬럼
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  VARCHAR(100),   -- 사용자 ID 또는 시스템 식별자
  updated_by  VARCHAR(100)
);
```

- `created_at`: 행이 처음 삽입된 시각. 변경되면 안 됩니다.
- `updated_at`: 마지막으로 수정된 시각. UPDATE마다 자동 갱신됩니다.
- `created_by`: 최초 생성한 사용자(또는 서비스). 변경되면 안 됩니다.
- `updated_by`: 마지막으로 수정한 사용자.

![감사 컬럼 스키마 설계](/assets/posts/pattern-audit-columns-schema.svg)

## TIMESTAMPTZ vs TIMESTAMP

타임스탬프 컬럼은 반드시 **TIMESTAMPTZ**(timezone-aware)를 사용해야 합니다. `TIMESTAMP`(without timezone)는 서버 로케일에 의존해, 서버를 다른 시간대로 이전하거나 여러 지역에 분산 배포하면 데이터가 일관성을 잃습니다.

```sql
-- 권장
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- NOW()는 항상 UTC로 저장, 읽을 때 세션 타임존으로 변환

-- 비권장
created_at TIMESTAMP NOT NULL DEFAULT NOW()
-- 타임존 정보 없음 → 분산 환경에서 혼란
```

## updated_at 자동 갱신

`updated_at`은 수동으로 UPDATE 문에 포함하면 빠뜨리기 쉽습니다. DB 트리거 또는 ORM 이벤트로 자동화합니다.

![updated_at 자동 갱신 — 트리거 vs ORM](/assets/posts/pattern-audit-columns-trigger.svg)

트리거 방식은 어떤 경로로 업데이트가 오든(ORM, Raw SQL, 마이그레이션) 항상 갱신됩니다. ORM 이벤트 방식은 ORM을 통하지 않는 업데이트는 놓칩니다. 중요한 데이터라면 트리거가 더 안전합니다.

## version 컬럼과 낙관적 잠금

`version` 컬럼은 동시 수정 충돌을 감지하는 **낙관적 잠금(Optimistic Locking)**에 사용됩니다.

```sql
-- version 컬럼 추가
ALTER TABLE orders ADD COLUMN version BIGINT NOT NULL DEFAULT 1;

-- 업데이트 시 version 확인
UPDATE orders
SET    status    = 'shipped',
       version   = version + 1,
       updated_at = NOW()
WHERE  id        = :order_id
  AND  version   = :expected_version;  -- 현재 버전 일치해야 성공

-- 영향받은 행 수 확인
-- 0이면 다른 트랜잭션이 먼저 수정 → 충돌 처리
```

사용자 A와 사용자 B가 동시에 같은 주문을 수정할 때, A가 먼저 커밋하면 version이 변합니다. B는 저장 시 version이 맞지 않아 UPDATE 영향 행이 0이 되고, 충돌을 감지해 재시도를 요청합니다.

```python
# Python — 낙관적 잠금 처리
def update_order(order_id, expected_version, new_status):
    result = db.execute("""
        UPDATE orders
        SET status = :status, version = version + 1, updated_at = NOW()
        WHERE id = :id AND version = :v
    """, {"status": new_status, "id": order_id, "v": expected_version})

    if result.rowcount == 0:
        raise OptimisticLockError(
            f"Order {order_id} was modified by another transaction"
        )
```

## created_by / updated_by 설정

작업자 정보는 애플리케이션 레이어에서 설정해야 합니다. DB 자체는 누가 요청했는지 모르기 때문입니다.

```python
# FastAPI 예시 — current_user를 audit 컬럼에 자동 설정
@router.put("/orders/{order_id}")
async def update_order(
    order_id: int,
    data: OrderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await db.execute("""
        UPDATE orders
        SET status = :status,
            updated_by = :user_id,
            updated_at = NOW(),
            version = version + 1
        WHERE id = :id
    """, {"status": data.status, "user_id": str(current_user.id), "id": order_id})
```

## 인덱스 전략

감사 컬럼에 인덱스를 추가하면 유용한 조회가 가능합니다.

```sql
-- 최근 변경된 데이터 조회용
CREATE INDEX idx_orders_updated_at ON orders(updated_at DESC);

-- 특정 사용자의 변경 이력 조회용
CREATE INDEX idx_orders_updated_by ON orders(updated_by)
  WHERE updated_by IS NOT NULL;

-- 최근 7일 내 생성된 주문 (부분 인덱스)
CREATE INDEX idx_orders_recent ON orders(created_at)
  WHERE created_at > NOW() - INTERVAL '7 days';
```

감사 컬럼만으로는 "무엇이 바뀌었는지"는 알 수 없습니다. 변경 이력의 상세 추적은 다음 글의 주제인 히스토리 테이블 패턴이 담당합니다.

---

**지난 글:** [Soft Delete vs Hard Delete](/posts/pattern-soft-delete-vs-hard-delete/)

**다음 글:** [변경 이력 추적 — 히스토리 테이블 패턴](/posts/pattern-history-audit-trail/)

<br>
읽어주셔서 감사합니다. 😊
