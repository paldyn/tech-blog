---
title: "string과 유니코드 완전 해부"
description: "JavaScript 문자열의 UTF-16 인코딩, 서로게이트 쌍, 코드 유닛 vs 코드 포인트, 유니코드 정규화, Intl.Segmenter를 활용한 올바른 문자열 처리를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "string", "유니코드", "UTF-16", "서로게이트", "코드포인트", "정규화"]
featured: false
draft: false
---

[지난 글](/posts/js-bigint/)에서 BigInt로 정수 한계를 넘어서는 방법을 다뤘습니다. 이번에는 원시 타입 중 가장 복잡한 내부 구조를 가진 `string`을 파고들겠습니다. "문자열을 다루는 건 쉽다"고 생각하기 쉽지만, 이모지 하나가 `length` 2를 차지하는 현실을 마주하면 이야기가 달라집니다.

## JavaScript 문자열은 UTF-16

JavaScript 엔진은 문자열을 **UTF-16** 코드 유닛의 시퀀스로 저장합니다. 각 코드 유닛은 16비트(2바이트)이며, `string.length`는 코드 포인트 수가 아닌 **코드 유닛 수**를 반환합니다.

유니코드는 U+0000부터 U+10FFFF까지 약 110만 개의 코드 포인트를 정의합니다. U+0000~U+FFFF 범위(BMP, Basic Multilingual Plane)는 1개의 코드 유닛으로 표현되고, U+10000 이상은 **서로게이트 쌍(surrogate pair)** — 2개의 코드 유닛 — 으로 표현됩니다.

```javascript
'A'.length;   // 1 (U+0041, BMP)
'한'.length;  // 1 (U+D55C, BMP)
'😀'.length;  // 2 (U+1F600, 서로게이트 쌍)
'𠮷'.length;  // 2 (U+20BB7, 서로게이트 쌍)
```

이 현상은 ES6 이전의 코드에 특히 위험합니다. 문자열을 배열처럼 인덱싱할 때 서로게이트 반쪽만 얻을 수 있습니다.

```javascript
const emoji = '😀world';
emoji[0]; // '\uD83D' (상위 서로게이트 — 깨진 문자)
emoji[1]; // '\uDE00' (하위 서로게이트 — 깨진 문자)
```

![UTF-16 인코딩과 코드 유닛 vs 코드 포인트](/assets/posts/js-string-unicode-encoding.svg)

## 코드 포인트 기반 처리

ES6부터는 코드 포인트를 올바르게 다루는 API가 추가됐습니다.

```javascript
// 코드 포인트 얻기
'😀'.codePointAt(0);         // 128512 (0x1F600)
String.fromCodePoint(128512); // '😀'

// 코드 유닛 vs 코드 포인트
'😀'.charCodeAt(0);   // 55357 (상위 서로게이트만)
'😀'.codePointAt(0);  // 128512 (전체 코드 포인트)

// 이터레이션: 서로게이트 자동 처리
[...'hello😀'].length; // 6 (올바른 문자 수)
for (const char of '😀👋') {
  console.log(char); // '😀', '👋' (각각 하나씩)
}
```

`for...of`와 스프레드 연산자(`...`)는 String Iterator를 사용하므로 서로게이트 쌍을 하나의 문자로 올바르게 처리합니다.

## 자소 클러스터 (Grapheme Cluster)

이모지 중 일부는 더 복잡합니다. 가족 이모지 '👨‍👩‍👧'는 실제로 여러 코드 포인트가 Zero-Width Joiner(ZWJ, U+200D)로 결합된 **자소 클러스터**입니다.

```javascript
const family = '👨‍👩‍👧';
family.length;        // 8 (코드 유닛)
[...family].length;   // 5 (코드 포인트)

// 진짜 문자 수는 Intl.Segmenter
const segmenter = new Intl.Segmenter();
[...segmenter.segment(family)].length; // 1 (눈에 보이는 문자)

// 한글 자모 결합도 주의
[...'가'.normalize('NFD')].length; // 2 (ㄱ + ㅏ)
```

사용자에게 문자 수를 보여주거나, 문자열을 시각적 단위로 잘라야 할 때는 `Intl.Segmenter`가 정답입니다.

## 유니코드 정규화 (NFC / NFD)

같은 글자가 서로 다른 코드 포인트 시퀀스로 표현될 수 있습니다. 'é'는 단일 코드 포인트 U+00E9(NFC)로도, 'e' + 결합 악센트 U+0301(NFD)로도 표현됩니다. 두 문자열은 `===`로 비교하면 `false`입니다.

```javascript
const nfc = 'é';       // é (조합)
const nfd = 'é'; // é (분해)

nfc === nfd; // false
nfc.normalize('NFC') === nfd.normalize('NFC'); // true
```

![유니코드 정규화 NFC vs NFD](/assets/posts/js-string-unicode-normalization.svg)

비교나 검색 전에 `.normalize('NFC')`를 적용하거나 `Intl.Collator`를 사용하면 안전합니다.

## 실용 패턴

```javascript
// 문자열 역순 (서로게이트 안전)
function reverseString(str) {
  return [...str].reverse().join('');
}
reverseString('hello😀'); // '😀olleh'

// 이모지 포함 문자열 잘라내기
function sliceByGrapheme(str, start, end) {
  const segmenter = new Intl.Segmenter();
  const segments = [...segmenter.segment(str)];
  return segments.slice(start, end).map(s => s.segment).join('');
}

// 코드 포인트 이스케이프 (ES6+)
'\u{1F600}' === '😀'; // true
String.fromCodePoint(0x1F600); // '😀'
```

문자열 처리에서 "그냥 `.length`를 쓴다"는 접근은 이모지나 다국어 텍스트가 없을 때만 안전합니다. 국제화 요구사항이 있다면 항상 코드 포인트 기준 API와 `Intl.Segmenter`를 활용하세요.

## 문자열 불변성

JavaScript의 문자열은 **불변(immutable)**입니다. `str[0] = 'X'`는 조용히 무시됩니다(strict mode에서도 에러 없음). 모든 문자열 메서드는 새 문자열을 반환합니다.

```javascript
let str = 'hello';
str[0] = 'H'; // 무시됨
console.log(str); // 'hello'

str = str.replace('h', 'H'); // 새 문자열
console.log(str); // 'Hello'
```

이 불변성 덕분에 문자열은 안전하게 공유되고 키(Map의 키, 객체 프로퍼티 키)로 사용될 수 있습니다.

---

**지난 글:** [BigInt — 안전한 정수 범위를 넘어서](/posts/js-bigint/)

**다음 글:** [Symbol과 Well-Known Symbol](/posts/js-symbol-well-known/)

<br>
읽어주셔서 감사합니다. 😊
