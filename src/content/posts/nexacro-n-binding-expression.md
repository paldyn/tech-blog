---
title: "[Nexacro N] 바인딩 표현식 — 계산 컬럼과 포맷"
description: "Nexacro N의 value 속성에 수식·조건·포맷 함수를 사용하는 방법과, ConstColumn으로 Dataset 내 계산 컬럼을 정의하는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "databinding", "binding-expression", "constcolumn", "formatDate"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-bindcolumn-value/)에서 `value`와 `bindcolumn` 속성의 기본 사용법을 살펴봤습니다. `value` 속성에는 단순 컬럼명뿐 아니라 Nexacro 표현식을 사용할 수 있습니다. 여러 컬럼을 조합하거나, 날짜를 포맷하거나, 조건에 따라 다른 값을 표시하는 데 활용합니다.

## value 속성에 표현식 사용

컬럼명 대신 표현식 문자열을 작성합니다. 표현식은 Dataset 필터 문법과 같은 규칙을 따릅니다.

```xml
<!-- 이름 + 부서 연결 표시 -->
<Static dataset="dsMain" value="name+' ('+dept+')'"/>

<!-- 단가 × 수량 계산 -->
<Static dataset="dsMain" value="price*qty"/>

<!-- 상태 코드에 따라 텍스트 전환 -->
<Static dataset="dsMain" value="status=='A'?'승인':'미승인'"/>
```

![바인딩 표현식 패턴](/assets/posts/nexacro-n-binding-expression-examples.svg)

표현식을 사용한 컴포넌트는 자동으로 읽기 전용이 됩니다. 사용자가 수정할 수 없고 Dataset에도 쓰지 않습니다. 계산 결과를 보여주는 레이블·Static 등에 적합합니다.

## 내장 함수 활용

Nexacro는 표현식 안에서 사용할 수 있는 내장 함수를 제공합니다.

```xml
<!-- 날짜 포맷 -->
<Static dataset="dsMain" value="formatDate(regdate,'YYYY-MM-DD')"/>

<!-- 숫자 천 단위 구분 -->
<Static dataset="dsMain" value="formatNumber(amt,'#,##0')"/>

<!-- 문자열 길이 제한 -->
<Static dataset="dsMain" value="substr(title,0,20)"/>
```

자주 쓰는 내장 함수:

| 함수 | 설명 |
|------|------|
| `formatDate(col, fmt)` | 날짜 컬럼을 지정 포맷으로 변환 |
| `formatNumber(col, fmt)` | 숫자 천 단위 콤마·소수점 포맷 |
| `substr(col, start, len)` | 문자열 부분 추출 |
| `trim(col)` | 앞뒤 공백 제거 |
| `len(col)` | 문자열 길이 |
| `toUpper(col)` / `toLower(col)` | 대소문자 변환 |

## ConstColumn — Dataset 내 계산 컬럼

복잡한 계산을 여러 컴포넌트에서 반복 사용한다면 `value` 표현식보다 `ConstColumn`이 더 적합합니다. `ConstColumn`은 Dataset 컬럼 정의에 수식을 포함해, 해당 컬럼을 참조하는 모든 컴포넌트에 자동으로 계산 결과를 제공합니다.

![ConstColumn으로 계산 컬럼 만들기](/assets/posts/nexacro-n-binding-expression-constcol.svg)

`ConstColumn`의 특징:
- Dataset에는 포함되지만 `transaction()` 전송 시 제외됩니다
- `getColumn(row, "TOTAL")`로 읽을 수 있습니다
- `setColumn(row, "TOTAL", val)`로 쓰는 것은 불가합니다 (계산 결과로 덮어써짐)
- Grid 셀의 `bindcolumn`으로 지정하면 전체 행의 계산값을 표시합니다

```javascript
// ConstColumn 값 읽기
var total = this.dsMain.getColumn(row, "TOTAL");
// = PRICE * QTY 자동 계산 결과

// ConstColumn 합계 — 반복문으로 합산
var sum = 0;
for (var i = 0; i < this.dsMain.rowcount; i++) {
    sum += this.dsMain.getColumn(i, "TOTAL");
}
```

## Grid 셀에서 표현식 사용

Grid 셀에도 `bindcolumn` 대신 표현식을 사용할 수 있습니다. Format 에디터에서 셀의 `text` 속성(또는 셀 표현식 항목)에 수식을 입력합니다.

```xml
<!-- Grid 셀에 표현식 (예시 의사 코드) -->
<!-- celltext: PRICE * QTY -->
```

실무에서는 Grid 셀 표현식보다 `ConstColumn`을 정의하고 `bindcolumn`으로 연결하는 방식이 유지보수하기 쉽습니다. 표현식이 분산되지 않고 Dataset에 집중됩니다.

## 표현식 디버깅

표현식이 의도대로 동작하지 않을 때는 `trace()`로 값을 확인합니다.

```javascript
// onchanged 또는 적절한 이벤트에서
trace("TOTAL=" + this.dsMain.getColumn(row, "TOTAL"));
trace("PRICE=" + this.dsMain.getColumn(row, "PRICE"));
trace("QTY="   + this.dsMain.getColumn(row, "QTY"));
```

표현식 컬럼명 오타, 타입 불일치(STRING × INT), NULL 값 처리 등이 일반적인 원인입니다.

---

**지난 글:** [[Nexacro N] bindcolumn과 value 속성 완전 정복](/posts/nexacro-n-bindcolumn-value/)

**다음 글:** [[Nexacro N] 동적 바인딩 — 런타임에 Dataset 교체하기](/posts/nexacro-n-binding-dynamic/)

<br>
읽어주셔서 감사합니다. 😊
