---
title: "MySQL FULLTEXT 인덱스 — 전문 검색 구현과 한계"
description: "InnoDB FULLTEXT 인덱스의 역인덱스 구조, NATURAL LANGUAGE·BOOLEAN·QUERY EXPANSION 검색 모드, 최��� 토큰 길이와 불용��� 설정, 한국어 검색을 위한 MeCab 파서까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 30
type: "knowledge"
category: "SQL"
tags: ["mysql", "fulltext-index", "full-text-search", "inverted-index", "boolean-mode", "mecab", "전문검색"]
featured: false
draft: false
---

[지난 글](/posts/mysql-functional-index/)에서 표����� 기반 Functional Index를 살펴봤습니다. 이번 글에서는 MySQL InnoDB의 **FULLTEXT 인덱스**로 전문(Full-Text) 검색을 구현하는 방법과 한계를 다룹니다.

## LIKE vs FULLTEXT

`LIKE '%keyword%'` 검색은 인덱스를 사용하지 못하고 Full Table Scan을 수행합니다. 텍스트 칼럼이 크거나 행 수가 많으면 성능이 급격히 저하됩니다. FULLTEXT 인덱스는 이 문제를 해결하기 위해 **역인덱스(Inverted Index)**를 사용합니다.

역인덱스는 "��떤 단어가 어�� 문서에 있는가"를 저장하는 구조입니다. 검색어를 찾을 때 모든 문서를 스캔하는 대신, 역인덱스에서 해당 단어의 문서 목록을 바로 조회합니다.

![InnoDB FULLTEXT 인덱스 구조](/assets/posts/mysql-fulltext-index-architecture.svg)

## FULLTEXT 인덱스 생성

```sql
-- 테이블 생성 시
CREATE TABLE articles (
    id      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title   VARCHAR(200) NOT NULL,
    body    TEXT         NOT NULL,
    FULLTEXT INDEX ft_title_body (title, body)
) ENGINE = InnoDB;

-- 기존 테이블에 추가
ALTER TABLE articles ADD FULLTEXT INDEX ft_body (body);

-- 또는
CREATE FULLTEXT INDEX ft_title ON articles (title);
```

하���의 FULLTEXT 인덱스에 여러 칼럼을 포함할 수 있습니다. `MATCH()` 함수에서 동일한 칼럼 조����� 사용해야 합니다.

## �� 가지 검색 모드

![BOOLEAN MODE 연산자 예시](/assets/posts/mysql-fulltext-index-boolean.svg)

**IN NATURAL LANGUAGE MODE** (기본값)는 입력 텍스트를 자연어로 처리합니다. 관련도(relevance) 점수를 계산해 반환하므로 ORDER BY score�� 정렬하면 가장 관련성 높은 결과가 앞에 옵니다. 전체 행의 50% 이상에 ��장하는 단어는 너무 흔하다��� 판단해 자동으로 무시합니다.

**IN BOOLEAN MODE**는 연산자를 사용한 정밀한 검색을 지원합니다. `+`는 필수, `-`는 제외, `*`는 와일드카드, `""`는 구문 검색입니다. 50% 임계값이 없어 소수 문서에서도 정확한 필터링이 가능합니다.

**WITH QUERY EXPANSION**은 1차 결과에�� 관련 단어를 추출해 쿼리를 자동으로 확장한 뒤 2차 검색합니다. 관련 주제의 문서도 포함되는 '맹목적 확장(Blind Query Expansion)'이라고도 합니다.

```sql
-- 관련도 점수 활용
SELECT
  id,
  title,
  MATCH(title, body) AGAINST('database performance') AS relevance
FROM articles
WHERE MATCH(title, body) AGAINST('database performance')
ORDER BY relevance DESC
LIMIT 10;

-- Boolean Mode: +필수 -제외
SELECT * FROM articles
WHERE MATCH(title, body)
  AGAINST('+InnoDB +index -deprecated' IN BOOLEAN MODE);

-- 구문 검색 ("exact phrase")
SELECT * FROM articles
WHERE MATCH(body) AGAINST('"clustered index"' IN BOOLEAN MODE);
```

## 최소 토큰 길이와 불용어

```sql
-- 최소 토큰 길이 확인 (기본 3)
SHOW VARIABLES LIKE 'innodb_ft_min_token_size';
-- → 3  (3자 ���만 ��어는 인덱싱 안 됨)

-- 최소 길이 변경 (my.cnf)
-- innodb_ft_min_token_size = 2

-- 불용어 확인
SELECT * FROM information_schema.innodb_ft_default_stopword;

-- 커스텀 불용어 테이블 사용
CREATE TABLE my_stopwords (value VARCHAR(30));
INSERT INTO my_stopwords VALUES ('the'), ('a'), ('이'), ('의');
SET GLOBAL innodb_ft_server_stopword_table = 'mydb/my_stopwords';

-- 변경 후 인덱스 재빌드 필요
ALTER TABLE articles DROP INDEX ft_title_body;
ALTER TABLE articles ADD FULLTEXT INDEX ft_title_body (title, body);
```

## 한국어 전문 검색 — MeCab 파서

기본 파서는 공백과 구두점을 기준으로 토큰을 분리합니다. 한국어, 일본어, 중국어처럼 공백 없이 단어가 붙어 있는 언어에서는 형태소 분석이 필요합니다.

MySQL은 일본어/한국어용 **MeCab 파서 플러그인**을 지원합니다.

```sql
-- MeCab 파서 플러그인 설치 (OS 수준에서 mecab 설치 ��)
INSTALL PLUGIN mecab SONAME 'libpluginmecab.so';

-- MeCab 파서로 FULLTEXT 인덱스
CREATE TABLE posts (
    id      INT  NOT NULL AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    FULLTEXT INDEX ft_content (content) WITH PARSER mecab
) ENGINE = InnoDB;

-- 또는 ngram 파서 (���장, MySQL 5.7.6+)
-- 연속 N글자를 토큰으로 분리 (기본 n=2)
CREATE FULLTEXT INDEX ft_ngram ON posts (content) WITH PARSER ngram;
SET GLOBAL ngram_token_size = 2;  -- 2-gram: 모든 2글자 조합을 인덱싱
```

**ngram 파서**는 외부 의존성 없이 한국어/���국어/일본어를 처리합니다. 모든 연속 N글자 조합을 인덱싱하므로 인덱스 크기가 크지��, 별도 형태소 분석기 없이 부분 일치 검색이 가능합니다.

## FULLTEXT의 한계와 대안

| 한계 | 설명 |
|---|---|
| 전체 단어 매칭 기본 | 부분 일치는 `word*` 와일드카드 필��� |
| 관련도 알고리즘 단순 | TF-IDF 기반, Elasticsearch 대��� 정���함 부족 |
| 한국어 형태소 분석 | MeCab 또는 ngram 파서 별도 설정 필요 |
| 실시간 업데이트 지연 | 삽입 직후 보조 테이블 캐시���서 메���으로 병합 지연 |
| 분산 검색 불가 | 단일 인스턴스 한정 |

대규모 전문 검색이 필요하��면 MySQL FULLTEXT 대신 **Elasticsearch**, **OpenSearch**, **Typesense** 같은 전문 검색 엔진과 동��화하는 방법을 고려하세요. MySQL FULLTEXT는 중소 규모의 단일 서버 환경에서 간단하게 검색 기능을 추가할 때 유용합니다.

MySQL ���덱스 시리즈를 여기서 마무리합니다. B+ Tree 기본 구조부터 클러스터드/세컨더리 인덱스, Leftmost Prefix, ICP, Invisible Index, Functional Index, FULLTEXT까지 InnoDB 인덱스의 핵심을 체계적으로 살펴봤습니다.

---

**����� 글:** [MySQL Functional Index — 표현식 기반 인덱스로 함수 쿼리 최적화](/posts/mysql-functional-index/)

<br>
읽어주셔서 감사합니다. 😊
