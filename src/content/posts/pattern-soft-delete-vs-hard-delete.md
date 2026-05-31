---
title: "Soft Delete vs Hard Delete — 논리 삭제의 트레이드오프"
description: "데이터 삭제 방식인 Soft Delete(deleted_at 컬럼)와 Hard Delete(물리 삭제)의 장단점을 비교하고, Soft Delete의 UNIQUE 제약 문제, 부분 인덱스로 해결하는 방법, 그리고 상황별 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["Soft Delete", "논리 삭제", "데이터 모델링", "인덱스", "GDPR"]
featured: false
draft: false
---

[지난 글](/posts/pattern-idempotency-deduplication/)에서 멱등성 패턴을 살펴봤습니다. 이번 글은 데이터 삭제 전략입니다. "삭제 버튼을 누르면 DB에서 어떻게 처리해야 하는가?" — 이 단순한 질문 뒤에 여러 트레이드오프가 숨어 있습니다.

## 두 가지 삭제 방식

**Hard Delete(물리 삭제)**는 `DELETE FROM users WHERE id = ?`로 실제 DB에서 행을 제거합니다. 단순하고 DB를 깔끔하게 유지하지만, 삭제된 데이터를 되살릴 수 없습니다.

**Soft Delete(논리 삭제)**는 `deleted_at`(또는 `is_deleted`) 컬럼에 삭제 시각을 표시하고 행은 유지합니다. 데이터는 여전히 DB에 있지만 `WHERE deleted_at IS NULL` 조건으로 "없는 것처럼" 처리합니다.

```sql
-- Soft Delete 컬럼 추가
ALTER TABLE users
  ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Soft Delete 실행
UPDATE users
SET    deleted_at = NOW()
WHERE  id = :user_id;

-- 활성 사용자만 조회 (모든 쿼리에 이 조건 추가)
SELECT *
FROM   users
WHERE  deleted_at IS NULL;
```

![Soft Delete vs Hard Delete 비교](/assets/posts/pattern-soft-delete-vs-hard-delete-comparison.svg)

## Soft Delete의 함정들

Soft Delete는 복구 가능성 때문에 매력적으로 보이지만, 주의하지 않으면 문제가 쌓입니다.

### 함정 1: 모든 쿼리에 필터 추가

`deleted_at IS NULL` 조건을 빠뜨리면 삭제된 데이터가 노출됩니다. ORM의 글로벌 스코프를 활용하거나 뷰(View)로 추상화하는 것이 안전합니다.

```sql
-- 뷰로 추상화 (삭제된 행 자동 필터)
CREATE VIEW active_users AS
SELECT * FROM users WHERE deleted_at IS NULL;

-- 또는 PostgreSQL Row Level Security
CREATE POLICY active_only ON users
  FOR SELECT USING (deleted_at IS NULL);
```

### 함정 2: UNIQUE 제약과의 충돌

이메일처럼 유일해야 하는 컬럼에 UNIQUE 제약이 있으면, 삭제된 사용자의 이메일이 DB에 남아 재가입이 불가합니다.

![UNIQUE 제약 문제와 부분 인덱스 해결](/assets/posts/pattern-soft-delete-vs-hard-delete-unique.svg)

```sql
-- PostgreSQL: 부분 인덱스로 해결
-- 활성 사용자(deleted_at IS NULL)만 UNIQUE 적용
CREATE UNIQUE INDEX idx_users_email_active
ON users(email)
WHERE deleted_at IS NULL;

-- 이제 같은 이메일로 여러 번 삭제/재가입 가능
-- 단, 활성 상태에서는 여전히 중복 불가
```

MySQL은 부분 인덱스를 지원하지 않으므로 삭제 시 email 값을 변경하는 방법을 사용합니다.

```sql
-- MySQL 대안: 삭제 시 이메일에 고유 접미사 추가
UPDATE users
SET deleted_at = NOW(),
    email = CONCAT(email, '#', UUID())
WHERE id = :user_id;
```

### 함정 3: 테이블 비대화

시간이 지나면 삭제된 행이 누적되어 테이블이 커집니다. 인덱스 크기도 함께 늘어납니다. 주기적인 아카이브 전략이 필요합니다.

```sql
-- 6개월 이상 지난 삭제 데이터 아카이브
INSERT INTO users_archive
SELECT * FROM users
WHERE  deleted_at < NOW() - INTERVAL '6 months';

DELETE FROM users
WHERE  deleted_at < NOW() - INTERVAL '6 months';
```

## Hard Delete가 맞는 경우

- **GDPR / 개인정보 삭제 요청**: "잊혀질 권리" — 데이터를 완전히 지워야 합니다. Soft Delete로는 규정 준수가 어렵습니다.
- **로그성 데이터**: 이벤트 로그, 오류 로그는 삭제가 의미 없어 Hard Delete 후 아카이브합니다.
- **임시 데이터**: 세션, 토큰, 임시 파일 등.

## Soft Delete가 맞는 경우

- **비즈니스 데이터**: 주문, 상품, 게시글 — 실수로 삭제했을 때 복구가 필요합니다.
- **외래 키 참조 유지**: 주문이 삭제된 상품을 참조하는 경우 Hard Delete하면 FK 오류가 발생합니다.
- **삭제 이력 감사**: "언제 누가 삭제했는지" 기록이 필요한 경우.

## 하이브리드: 아카이브 테이블

중요한 데이터에서 Hard Delete를 하되 별도 아카이브 테이블에 보관하는 방식입니다.

```sql
-- 삭제 전 아카이브
CREATE TABLE users_deleted (LIKE users INCLUDING ALL);

INSERT INTO users_deleted SELECT * FROM users WHERE id = :id;
DELETE FROM users WHERE id = :id;
```

이 방법은 메인 테이블을 깔끔하게 유지하면서도 복구 가능성을 보장합니다. GDPR 요청 시 아카이브에서도 삭제하면 됩니다. 다음 글에서는 변경 이력을 자동으로 기록하는 감사 컬럼 패턴을 살펴봅니다.

---

**지난 글:** [멱등성과 중복 처리 방지 패턴](/posts/pattern-idempotency-deduplication/)

**다음 글:** [감사 컬럼 패턴 — created_at, updated_at, created_by](/posts/pattern-audit-columns/)

<br>
읽어주셔서 감사합니다. 😊
