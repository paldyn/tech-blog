---
title: "PostgreSQL 언어 옵션 — SQL, PL/pgSQL, PL/Python, C까지"
description: "PostgreSQL 서버 사이드 함수에서 사용할 수 있는 언어 SQL·PL/pgSQL·PL/Python·PL/Perl·PL/Tcl·C를 신뢰도(TRUSTED/UNTRUSTED)·성능·설치 방법·주요 용도 기준으로 비교하고, PL/Python의 SD·GD 캐시와 SPI 쿼리 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["postgresql", "plpgsql", "plpython", "sql-function", "procedural-languages", "trusted", "untrusted", "spi", "c-extension", "plperl"]
featured: false
draft: false
---

[지난 글](/posts/pg-procedure-call/)에서 PROCEDURE의 트랜잭션 제어 기능을 살펴봤다. 이번에는 PostgreSQL 함수·프로시저를 작성할 때 선택할 수 있는 **언어(Language)** 전체를 살펴본다. SQL과 PL/pgSQL이 기본이지만, 파이썬·펄·Tcl·C까지 다양한 옵션이 있다.

## 언어 종류와 신뢰도

PostgreSQL은 서버 사이드 함수에서 여러 언어를 지원한다. 언어마다 **신뢰도(Trust)** 가 다르다.

![PostgreSQL 서버 사이드 언어 비교](/assets/posts/pg-language-options-comparison.svg)

**TRUSTED** 언어는 일반 사용자도 함수를 만들 수 있다. 파일시스템·네트워크에 접근하는 OS 호출이 차단되어 데이터베이스 내부에만 영향을 준다. **UNTRUSTED** 언어는 슈퍼유저만 생성할 수 있고, OS 수준 리소스에 접근할 수 있으므로 신뢰된 환경에서만 허용해야 한다.

## SQL 함수

가장 단순한 형태다. 단일 표현식이나 쿼리를 함수로 래핑할 때 적합하다. 옵티마이저가 호출 지점에서 함수 본문을 인라인(inline)할 수 있어 성능이 가장 좋다.

```sql
CREATE FUNCTION total_price(qty INT, unit_price NUMERIC)
RETURNS NUMERIC AS $$
  SELECT qty * unit_price;
$$ LANGUAGE sql IMMUTABLE;

-- 옵티마이저가 호출 지점에서 직접 식으로 펼침
SELECT total_price(3, 9.99);  -- → SELECT 3 * 9.99
```

`IMMUTABLE`로 선언하면 같은 입력에 항상 같은 출력을 보장한다고 명시되어, 쿼리 계획 단계에서 상수로 계산될 수 있다.

## PL/pgSQL

업무 로직 작성의 표준이다. 조건문, 루프, 예외 처리, 커서 등 절차적 구조를 모두 지원한다.

```sql
CREATE OR REPLACE FUNCTION clamp(val NUMERIC, lo NUMERIC, hi NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN GREATEST(lo, LEAST(hi, val));
END;
$$;
```

트리거, 프로시저, 복잡한 비즈니스 로직 모두 PL/pgSQL이 기본 선택이다.

## PL/Python — Python 생태계 활용

파이썬 라이브러리(NumPy, scikit-learn, pandas 등)를 DB 함수 안에서 직접 호출할 수 있다.

![PL/Python 함수 예제](/assets/posts/pg-language-options-plpython.svg)

```sql
-- 언어 설치 확인
SELECT * FROM pg_available_extensions WHERE name = 'plpython3u';

-- 설치 (슈퍼유저)
CREATE EXTENSION IF NOT EXISTS plpython3u;

-- 예: 간단한 JSON 파싱
CREATE OR REPLACE FUNCTION parse_tags(json_text TEXT)
RETURNS TEXT[]
LANGUAGE plpython3u AS $$
  import json
  return json.loads(json_text).get('tags', [])
$$;
```

`plpython3u`의 `u`는 UNTRUSTED를 의미한다. 슈퍼유저만 함수를 생성할 수 있으며, 해당 함수를 다른 사용자가 **실행**하는 것은 `GRANT EXECUTE`로 허용할 수 있다.

### SD와 GD — 세션 캐시

PL/Python 함수는 Python 딕셔너리 `SD`(Session Dictionary)와 `GD`(Global Dictionary)를 제공한다.

- `SD`: 해당 함수의 세션 단위 로컬 캐시
- `GD`: 동일 백엔드 프로세스(세션)에서 실행되는 모든 PL/Python 함수가 공유

무거운 모델 로딩이나 룩업 테이블을 한 번만 로드하고 재사용하는 패턴에 유용하다.

## PL/Perl

정규식과 문자열 처리에 강하다. `plperl`(TRUSTED)과 `plperlu`(UNTRUSTED) 두 가지가 있다.

```sql
CREATE EXTENSION IF NOT EXISTS plperl;

CREATE FUNCTION extract_domain(email TEXT)
RETURNS TEXT LANGUAGE plperl AS $$
  my $e = $_[0];
  $e =~ /\@(.+)$/;
  return $1;
$$;
```

현대 프로젝트에서는 PL/Python이 대부분 대체하고 있지만, Perl 친화적 환경에서는 여전히 유효하다.

## C 언어 — 최고 성능

C로 작성된 공유 라이브러리(`.so`)를 `LANGUAGE c`로 등록한다. 성능이 가장 중요하거나 PostgreSQL 내부 자료구조에 직접 접근해야 할 때 사용한다. 대부분의 PostgreSQL 확장(PostGIS, pg_trgm, hstore 등)이 C로 구현되어 있다.

```sql
-- 컴파일된 .so 파일을 PostgreSQL 라이브러리 디렉터리에 배치 후
CREATE FUNCTION my_c_func(INT) RETURNS INT
LANGUAGE c STRICT
AS 'my_library', 'my_c_func';
```

잘못된 C 코드는 서버 프로세스를 크래시할 수 있으므로, UNTRUSTED이며 충분한 테스트가 필수다.

## 사용자 정의 언어 — PL/v8, PL/Java

서드파티 언어도 확장으로 등록할 수 있다.

| 언어 | 설명 |
|------|------|
| PL/v8 | V8 JavaScript 엔진. JSONB 처리에 강함 |
| PL/Java | JVM 기반. Java 라이브러리 활용 |
| PL/Lua | Lua 인터프리터. 경량 스크립팅 |

이들은 별도 빌드·설치가 필요하고 PostgreSQL 버전마다 호환성을 확인해야 한다.

## 언어 선택 기준 정리

```sql
-- 현재 DB에 설치된 언어 확인
SELECT lanname, lanpltrusted, lanvalidator::regproc
FROM pg_language
ORDER BY lanname;
```

- 단순 계산·집계 → `SQL`
- 조건·루프·트리거·프로시저 → `PL/pgSQL`
- ML·데이터 변환·외부 API 호출 → `PL/Python`
- 초고성능·확장 개발 → `C`

대부분의 팀은 `SQL`과 `PL/pgSQL`만으로 충분하다. `PL/Python`은 ML 파이프라인을 DB 내부로 가져올 때 강력한 선택지가 된다.

---

**지난 글:** [PostgreSQL 프로시저 — CALL과 트랜잭션 제어](/posts/pg-procedure-call/)

**다음 글:** [PostgreSQL 함수 파라미터와 다형성 — ANYELEMENT, 오버로딩](/posts/pg-function-parameters-polymorphism/)

<br>
읽어주셔서 감사합니다. 😊
