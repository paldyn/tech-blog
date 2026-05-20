---
title: "csv 모듈: CSV 파일 읽기와 쓰기"
description: "Python csv 모듈 사용법을 정리합니다. reader/writer와 DictReader/DictWriter 차이, delimiter/quotechar/dialect 옵션, newline='' 주의사항, StringIO 활용, 한글 인코딩 처리, 대용량 파일 처리 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "csv", "파일입출력", "DictReader", "DictWriter", "데이터처리", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-json-module/)에서 `json` 모듈로 JSON을 다루는 방법을 살펴봤습니다. 이번 글에서는 스프레드시트와 데이터 분석에서 빠질 수 없는 CSV 형식을 처리하는 `csv` 모듈을 정리합니다. 쉼표 하나로 만들어지는 단순해 보이는 형식이지만, 인용 문자, 줄바꿈, 인코딩 문제가 숨어 있어 올바른 API를 알아야 합니다.

## 네 가지 핵심 클래스

`csv` 모듈의 핵심은 두 쌍의 클래스입니다.

| 클래스 | 방향 | 반환/입력 |
|---|---|---|
| `csv.reader` | 읽기 | 행마다 `list[str]` |
| `csv.DictReader` | 읽기 | 행마다 `dict` |
| `csv.writer` | 쓰기 | `list` 입력 |
| `csv.DictWriter` | 쓰기 | `dict` 입력 |

![csv 모듈 구조](/assets/posts/python-csv-module-flow.svg)

## 읽기: reader vs DictReader

```python
import csv

# reader — 행마다 list
with open('users.csv', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader)   # 헤더 건너뛰기
    for row in reader:
        name = row[0]
        age  = int(row[1])   # 모든 값은 str

# DictReader — 행마다 dict (헤더 자동 인식)
with open('users.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        name = row['name']
        age  = int(row['age'])
```

`DictReader`는 첫 번째 행을 헤더로 자동 인식합니다. 열 이름으로 접근할 수 있어 열 순서 변경에도 코드가 깨지지 않습니다.

헤더가 없는 CSV라면 `fieldnames`를 직접 지정하세요.

```python
with open('no_header.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f, fieldnames=['id', 'name', 'score'])
    for row in reader:
        print(row['name'])
```

## 쓰기: writer vs DictWriter

```python
import csv

# writer
with open('out.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['name', 'age', 'city'])   # 헤더
    w.writerow(['Alice', 30, 'Seoul'])
    w.writerows([['Bob', 25, 'Busan'], ['Carol', 28, 'Daegu']])

# DictWriter
fields = ['name', 'age', 'city']
rows = [
    {'name': 'Alice', 'age': 30, 'city': 'Seoul'},
    {'name': 'Bob',   'age': 25, 'city': 'Busan'},
]

with open('out.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)
```

**`newline=''`은 쓰기 모드에서 필수입니다.** 이 옵션 없이 Windows에서 실행하면 각 행에 빈 줄이 추가됩니다. Python `csv` 모듈이 내부적으로 `\r\n` 줄 끝을 처리하므로, 파일 오픈 시 OS의 줄 끝 변환이 없어야 합니다.

![csv 코드 패턴](/assets/posts/python-csv-module-code.svg)

## 구분자와 dialect 옵션

쉼표가 아닌 다른 구분자를 쓰는 경우도 많습니다.

```python
import csv

# 탭으로 구분된 TSV
with open('data.tsv', encoding='utf-8') as f:
    for row in csv.reader(f, delimiter='\t'):
        print(row)

# 파이프(|) 구분자 — dialect 등록
csv.register_dialect('pipe', delimiter='|', quoting=csv.QUOTE_MINIMAL)

with open('data.pipe', encoding='utf-8') as f:
    for row in csv.reader(f, dialect='pipe'):
        print(row)
```

`csv.list_dialects()`로 등록된 dialect 목록을 확인할 수 있습니다. 기본 제공되는 `excel` (쉼표, `"` 인용)과 `excel-tab` (탭, `"` 인용)이 있습니다.

## 인용 옵션

```python
import csv
from io import StringIO

# QUOTE_ALL — 모든 필드를 따옴표로 감쌈
output = StringIO()
w = csv.writer(output, quoting=csv.QUOTE_ALL)
w.writerow(['Alice', 30, 'Hello, World'])
print(output.getvalue())
# "Alice","30","Hello, World"

# QUOTE_NONNUMERIC — 숫자가 아닌 필드만 감쌈
# QUOTE_NONE — 따옴표 사용 안 함 (특수문자 포함 시 오류)
# QUOTE_MINIMAL (기본) — 필요한 경우만 감쌈
```

## StringIO로 메모리에서 처리

파일 없이 문자열로 CSV를 파싱할 때 `io.StringIO`를 씁니다.

```python
from io import StringIO
import csv

csv_text = "name,age\nAlice,30\nBob,25"

reader = csv.DictReader(StringIO(csv_text))
for row in reader:
    print(row['name'], int(row['age']))
```

API 응답이나 업로드된 CSV를 처리할 때 자주 쓰는 패턴입니다.

## 한글 인코딩

Excel에서 저장한 CSV는 보통 `cp949`(EUC-KR) 인코딩입니다.

```python
# 한국 Excel CSV 읽기
with open('korean.csv', encoding='cp949') as f:
    for row in csv.DictReader(f):
        print(row)

# UTF-8 BOM (Excel이 UTF-8로 저장할 때 생성)
with open('utf8bom.csv', encoding='utf-8-sig') as f:
    for row in csv.DictReader(f):
        print(row)
```

`utf-8-sig`는 파일 앞의 BOM(`\xef\xbb\xbf`)을 자동으로 제거합니다.

## 대용량 파일 처리

`csv.reader`는 지연 평가로 한 줄씩 읽으므로 수백만 행 파일도 메모리 걱정 없이 처리할 수 있습니다.

```python
import csv

total = 0
with open('large.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        total += int(row['amount'])
print(f"합계: {total}")
```

pandas를 쓸 수 없는 환경이나 변환 없이 스트리밍 처리해야 할 때 유용합니다.

---

**지난 글:** [json 모듈: JSON 직렬화와 역직렬화](/posts/python-json-module/)

**다음 글:** [pickle: Python 객체 직렬화](/posts/python-pickle/)

<br>
읽어주셔서 감사합니다. 😊
