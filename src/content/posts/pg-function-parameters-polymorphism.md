---
title: "PostgreSQL 함수 파라미터와 다형성 — ANYELEMENT, 오버로딩"
description: "PostgreSQL 함수의 IN·OUT·INOUT·VARIADIC 파라미터 모드, 함수 오버로딩(같은 이름 다른 시그니처), ANYELEMENT·ANYARRAY·ANYRANGE 등 다형성 타입, DEFAULT 값, 네임드 표기법으로 가독성 높이는 법을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["postgresql", "function-overloading", "anyelement", "anyarray", "polymorphism", "variadic", "out-parameter", "inout", "default-parameter", "plpgsql"]
featured: false
draft: false
---

[지난 글](/posts/pg-language-options/)에서 PostgreSQL 함수에서 사용할 수 있는 다양한 언어를 살펴봤다. 이번에는 함수 **파라미터** 자체를 깊이 파고든다. 파라미터 모드, 오버로딩, 다형성 타입까지 알면 훨씬 재사용성 높은 함수를 작성할 수 있다.

## 파라미터 모드: IN · OUT · INOUT · VARIADIC

PostgreSQL 함수 파라미터에는 네 가지 모드가 있다.

| 모드 | 역할 | 기본 여부 |
|------|------|-----------|
| `IN` | 입력 전용 | 기본값 (생략 가능) |
| `OUT` | 출력 전용 (반환값 구성) | 명시 필요 |
| `INOUT` | 입력이자 출력 | 명시 필요 |
| `VARIADIC` | 가변 개수 인자 (배열로 수집) | 명시 필요 |

`OUT` 파라미터를 하나 이상 정의하면 `RETURNS` 절 없이도 복수 값을 반환할 수 있다. 반환 타입은 암묵적으로 `RECORD`(또는 단일 `OUT`이면 해당 타입)가 된다.

## 함수 오버로딩

![함수 오버로딩과 파라미터 모드](/assets/posts/pg-function-parameters-polymorphism-overload.svg)

PostgreSQL은 함수 이름이 같아도 **파라미터 타입이 다르면** 별개의 함수로 등록한다. 이를 오버로딩(Overloading)이라 한다.

```sql
-- 같은 이름, 다른 시그니처
CREATE FUNCTION area(r FLOAT) RETURNS FLOAT LANGUAGE sql AS
  $$ SELECT pi() * r * r $$;

CREATE FUNCTION area(w FLOAT, h FLOAT) RETURNS FLOAT LANGUAGE sql AS
  $$ SELECT w * h $$;

SELECT area(3.0);       -- 원 넓이
SELECT area(4.0, 5.0);  -- 직사각형 넓이
```

오버로딩 함수를 삭제할 때는 시그니처를 명시해야 한다.

```sql
DROP FUNCTION area(FLOAT);         -- 첫 번째 버전만 삭제
DROP FUNCTION area(FLOAT, FLOAT);  -- 두 번째 버전 삭제
```

## DEFAULT 파라미터 값

```sql
CREATE OR REPLACE FUNCTION paginate(
  p_limit  INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(id INT, name TEXT)
LANGUAGE sql AS $$
  SELECT id, name FROM items
  ORDER BY id
  LIMIT p_limit OFFSET p_offset;
$$;

-- 다양한 호출 방식
SELECT * FROM paginate();           -- limit=20, offset=0
SELECT * FROM paginate(10);         -- limit=10, offset=0
SELECT * FROM paginate(10, 40);     -- limit=10, offset=40
SELECT * FROM paginate(p_offset => 40);  -- 네임드 표기
```

네임드 표기(`p_offset => 40`)를 사용하면 중간 파라미터를 건너뛸 수 있어 가독성이 높아진다.

## 다형성 타입

![PostgreSQL 다형성 타입](/assets/posts/pg-function-parameters-polymorphism-types.svg)

다형성 타입을 쓰면 하나의 함수 정의로 여러 실제 타입에 작동하는 제네릭 함수를 만들 수 있다.

```sql
-- ANYELEMENT: 같은 타입이라면 무엇이든
CREATE FUNCTION coalesce2(a ANYELEMENT, b ANYELEMENT)
RETURNS ANYELEMENT LANGUAGE sql AS $$
  SELECT COALESCE(a, b);
$$;

SELECT coalesce2(NULL::INT, 42);      -- → 42 (INT)
SELECT coalesce2(NULL::TEXT, 'hi');   -- → 'hi' (TEXT)
```

```sql
-- ANYARRAY + ANYELEMENT: 배열에서 첫 번째 값 꺼내기
CREATE FUNCTION first_elem(arr ANYARRAY) RETURNS ANYELEMENT
LANGUAGE sql AS $$ SELECT arr[1] $$;

SELECT first_elem(ARRAY[10, 20, 30]);    -- → 10
SELECT first_elem(ARRAY['a', 'b']);       -- → 'a'
```

`ANYELEMENT`와 `ANYARRAY`를 함께 쓰면 PostgreSQL이 배열의 원소 타입과 `ANYELEMENT` 타입이 일치하는지 자동으로 검증한다.

## VARIADIC — 가변 인자

`VARIADIC` 파라미터는 0개 이상의 인자를 받아 배열로 모아준다. 마지막 파라미터에만 사용할 수 있다.

```sql
CREATE FUNCTION greatest_of(VARIADIC vals ANYARRAY)
RETURNS ANYELEMENT LANGUAGE sql AS $$
  SELECT max(v) FROM unnest(vals) AS v;
$$;

SELECT greatest_of(3, 1, 4, 1, 5, 9);   -- → 9
SELECT greatest_of('cat', 'dog', 'ant'); -- → 'dog'

-- 이미 배열이 있으면 VARIADIC 키워드로 전달
SELECT greatest_of(VARIADIC ARRAY[3, 1, 4]);
```

## STRICT — NULL 단락 평가

`STRICT` 키워드를 붙이면 임의의 파라미터가 `NULL`일 때 함수 본문을 실행하지 않고 즉시 `NULL`을 반환한다.

```sql
CREATE FUNCTION safe_divide(a NUMERIC, b NUMERIC)
RETURNS NUMERIC LANGUAGE sql STRICT AS $$
  SELECT a / b;
$$;

SELECT safe_divide(10, NULL);  -- → NULL (본문 미실행)
SELECT safe_divide(10, 0);     -- division by zero 오류 (NULL이 아니므로 실행됨)
```

불필요한 NULL 체크 코드를 줄여주지만, 입력 중 하나라도 NULL이면 결과가 NULL이 되어도 괜찮은 경우에만 사용한다.

## 함수 해석 우선순위

같은 이름에 오버로딩이 많을 때 PostgreSQL은 다음 순서로 후보를 찾는다.

1. 인자 타입이 정확히 일치하는 함수
2. 암묵적 타입 캐스팅으로 일치하는 함수
3. 다형성 타입으로 일치하는 함수

모호한 경우 "ambiguous function call" 오류가 발생한다. 타입을 명시적으로 캐스팅(`::INT`, `::TEXT`)하면 해결할 수 있다.

## pg_proc로 확인

```sql
-- 같은 이름의 오버로딩 함수 조회
SELECT proname, pg_catalog.pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'add'
  AND pronamespace = 'public'::regnamespace;
```

---

**지난 글:** [PostgreSQL 언어 옵션 — SQL, PL/pgSQL, PL/Python, C까지](/posts/pg-language-options/)

**다음 글:** [PostgreSQL 확장 시스템 — CREATE EXTENSION과 주요 확장들](/posts/pg-extension-system/)

<br>
읽어주셔서 감사합니다. 😊
