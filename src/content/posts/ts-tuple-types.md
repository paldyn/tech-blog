---
title: "튜플 타입 — 고정 길이 이종 배열의 완전 정복"
description: "TypeScript 튜플 타입의 선언 방법, 명명된 튜플, 옵셔널 요소, rest 요소를 코드 예제와 함께 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "튜플", "tuple", "명명된튜플", "분해할당"]
featured: false
draft: false
---

[지난 글](/posts/ts-readonly-arrays/)에서 읽기 전용 배열을 살펴봤다. 이번 글에서는 TypeScript의 **튜플 타입(Tuple Types)**을 완전히 정복한다. 튜플은 배열과 비슷해 보이지만, 각 위치마다 타입이 고정되고 길이도 미리 정해진다는 점에서 근본적으로 다르다.

![튜플 타입 구조](/assets/posts/ts-tuple-types-structure.svg)

## 튜플 타입이란

튜플은 **고정된 길이와 위치별 타입을 갖는 배열**이다. 일반 배열이 `number[]`처럼 "숫자들의 목록"을 표현한다면, 튜플은 `[string, number, boolean]`처럼 "첫 번째는 문자열, 두 번째는 숫자, 세 번째는 불리언"이라는 구체적인 구조를 표현한다.

```typescript
// 일반 배열: 모든 요소가 같은 타입
const nums: number[] = [1, 2, 3, 4, 5];

// 튜플: 각 위치에 다른 타입
type Point = [number, number];       // 2D 좌표
type Entry = [string, number];       // 이름과 점수
type RGB = [number, number, number]; // 색상 채널

const origin: Point = [0, 0];
const score: Entry = ["Alice", 95];
const red: RGB = [255, 0, 0];

// 타입 오류: 개수나 타입이 다르면 에러
const wrong1: Point = [1];           // Error: 요소가 부족
const wrong2: Entry = [42, "name"];  // Error: 순서가 틀림
const wrong3: RGB = [255, 0, 0, 1];  // Error: 요소가 너무 많음
```

배열로는 `(string | number)[]`라고 써야 하는 것을 튜플로는 더 정확하게 타입을 지정할 수 있다. 컴파일러가 각 인덱스의 타입까지 추적해주기 때문에 훨씬 안전하다.

## 명명된 튜플 (TS 4.0+)

TypeScript 4.0부터 **명명된 튜플(Named Tuples)**을 사용할 수 있다. 각 요소에 라벨을 붙여 IDE 툴팁과 오류 메시지를 훨씬 읽기 쉽게 만든다.

```typescript
// 일반 튜플: 위치만 표시
type Point2D = [number, number];

// 명명된 튜플: 라벨이 있어 의미 명확
type Point2DLabeled = [x: number, y: number];
type ColorRGB = [red: number, green: number, blue: number];
type Range = [start: number, end: number];
```

라벨은 **타입 추론에는 영향을 주지 않는다**. 라벨이 있어도 없어도 실제 타입 동작은 동일하며, 오직 가독성과 IDE 지원만 개선된다.

```typescript
type ColorRGB = [red: number, green: number, blue: number];

const pink: ColorRGB = [255, 182, 193];

// IDE에서 pink[0]에 마우스를 올리면 "(parameter) red: number"로 표시됨
// 라벨 없이 [number, number, number]였다면 그냥 "number"로만 표시
```

함수 매개변수 타입을 보여줄 때 특히 유용하다:

```typescript
// 라벨 없는 경우: (number, number) => string — 무슨 숫자인지 불명확
type Formatter = (args: [number, number]) => string;

// 라벨 있는 경우: (args: [width: number, height: number]) => string
type FormatterLabeled = (args: [width: number, height: number]) => string;
```

## 옵셔널 요소와 rest 요소

### 옵셔널 요소

`?`를 붙이면 해당 위치의 요소를 생략할 수 있다. 단, 옵셔널 요소는 **반드시 마지막 부분**에만 위치해야 한다.

```typescript
type Pair = [string, number?];
// [string] 또는 [string, number] 모두 유효

const a: Pair = ["hello"];         // OK
const b: Pair = ["hello", 42];     // OK
const c: Pair = ["hello", 42, true]; // Error: 요소가 너무 많음

// 옵셔널은 끝에서부터만
type ThreeOpt = [string, number?, boolean?]; // OK
// type InvalidOpt = [string?, number]; // Error: 필수 요소가 옵셔널 뒤에 올 수 없음
```

### rest 요소

`...`를 사용해 **가변 길이 부분**을 표현할 수 있다. rest 요소는 중간이나 끝에 위치할 수 있다.

```typescript
// 끝에 rest 요소: 최소 1개의 string 뒤에 number들
type StringsThenNumber = [...string[], number];

const d: StringsThenNumber = [42];              // OK (string 0개, number 1개)
const e: StringsThenNumber = ["a", "b", 42];    // OK
const f: StringsThenNumber = ["a", "b", "c", 99]; // OK

// 처음에 rest 요소
type NumberThenStrings = [number, ...string[]];

const g: NumberThenStrings = [1];               // OK
const h: NumberThenStrings = [1, "a", "b"];     // OK

// 중간에 rest 요소 (TS 4.2+)
type Middle = [string, ...number[], boolean];
```

## 구조 분해와 튜플

튜플의 가장 유용한 기능 중 하나는 **구조 분해 할당(Destructuring Assignment)**과의 궁합이다.

```typescript
type Point3D = [x: number, y: number, z: number];
const point: Point3D = [10, 20, 30];

// 구조 분해로 의미 있는 변수명 부여
const [x, y, z] = point;
console.log(x); // 10
console.log(y); // 20

// 일부 요소만 추출 (나머지는 _로 무시)
const [px, , pz] = point; // y 무시
const [first, ...rest] = point; // rest = [20, 30]

// 함수 매개변수에서 바로 분해
function formatPoint([x, y, z]: Point3D): string {
  return `(${x}, ${y}, ${z})`;
}

formatPoint([1, 2, 3]); // "(1, 2, 3)"
```

구조 분해 시 TypeScript는 각 변수의 타입을 자동으로 추론한다. `x`, `y`, `z`는 모두 `number` 타입으로 추론된다.

## 함수 반환값으로의 튜플

튜플의 가장 강력한 활용 사례는 **함수가 여러 값을 반환할 때**다. React의 `useState` 훅이 대표적인 예시다.

```typescript
// [값, 세터] 패턴
function useState<T>(init: T): [T, (value: T) => void] {
  let state = init;
  const setState = (value: T) => { state = value; };
  return [state, setState];
}

const [count, setCount] = useState(0);
// count: number, setCount: (value: number) => void

const [name, setName] = useState("Alice");
// name: string, setName: (value: string) => void
```

`as const`로 더 정확한 타입을 만들 수도 있다:

```typescript
function makeRange(start: number, end: number) {
  return [start, end] as const;
  // 반환 타입: readonly [number, number] — 튜플로 추론됨
}

// 주의: as const 없이는 number[]로 추론
function makeRangeWide(start: number, end: number) {
  return [start, end]; // 반환 타입: number[]
}
```

## 배열 vs 튜플 선택 기준

언제 배열을 쓰고 언제 튜플을 써야 할까?

```typescript
// 배열을 써야 할 때: 같은 타입, 가변 길이
const primes: number[] = [2, 3, 5, 7, 11];
const names: string[] = ["Alice", "Bob", "Charlie"];
const flags: boolean[] = [true, false, true];

// 튜플을 써야 할 때: 다른 타입, 고정 구조
type HttpResponse = [status: number, body: string];
type Coordinate = [lat: number, lng: number];
type KeyValue<K, V> = [key: K, value: V];

// 경계선 케이스: 같은 타입이지만 의미가 다르면 튜플
type ScreenSize = [width: number, height: number]; // 튜플 권장
// number[]로 쓰면 순서 실수의 위험이 있다
```

**튜플이 유리한 경우:**
- 요소 개수가 고정되어 있고 각 위치의 의미가 중요할 때
- 함수가 의미적으로 다른 여러 값을 반환할 때
- 구조 분해로 바로 변수에 바인딩할 때

**객체가 유리한 경우:**
- 요소가 4개 이상으로 많아질 때
- 각 요소에 의미 있는 이름이 필요할 때
- 일부 필드만 선택적으로 사용할 때

![튜플 활용 패턴](/assets/posts/ts-tuple-types-patterns.svg)

## 실전 예시: CSV 파싱

튜플은 CSV나 TSV처럼 위치 기반 데이터를 처리할 때 특히 강력하다.

```typescript
type CSVRow = [name: string, age: number, active: boolean];

function parseRow(line: string): CSVRow {
  const [name, ageStr, activeStr] = line.split(",");
  return [name.trim(), parseInt(ageStr), activeStr.trim() === "true"];
}

const rows: CSVRow[] = [
  "Alice,30,true",
  "Bob,25,false",
  "Charlie,35,true",
].map(parseRow);

for (const [name, age, active] of rows) {
  if (active) {
    console.log(`${name} (${age}세): 활성`);
  }
}
```

배열보다 구체적인 타입 정보 덕분에, `active`를 boolean이 아닌 string으로 사용하면 컴파일 에러로 잡아낼 수 있다.

---

**지난 글:** [읽기 전용 배열 — ReadonlyArray와 readonly 수식어 완전 정리](/posts/ts-readonly-arrays/)

**다음 글:** [가변 인자 튜플 — 스프레드와 추론으로 복잡한 타입 다루기](/posts/ts-variadic-tuples/)

<br>
읽어주셔서 감사합니다. 😊
