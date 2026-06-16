---
title: "fs / path 타이핑 — 파일 시스템 API 안전하게"
description: "Node의 fs와 path 모듈을 TypeScript에서 안전하게 쓰는 법을 정리합니다. 인코딩 인자에 따라 Buffer/string으로 갈리는 오버로드, fs/promises 사용, path 결합과 PlatformPath, Dirent·Stats 타입과 에러 코드 좁히기까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "Node", "fs", "path", "파일시스템", "오버로드"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-node-core/)에서 `@types/node`가 내장 모듈에 타입을 입히는 원리를 봤다. 이번 글은 그중 가장 자주 쓰는 `fs`와 `path`를 구체적으로 다룬다. 파일 시스템 API는 같은 함수가 인자에 따라 다른 타입을 반환하거나, 에러를 던지는 등 타입 함정이 많은 영역이다. 오버로드의 동작 원리를 이해하면 불필요한 단언 없이 정확한 타입을 받을 수 있다.

## readFile의 인코딩 오버로드

`fs.readFile`은 인코딩 인자에 따라 반환 타입이 달라진다. 인코딩을 주지 않으면 `Buffer`, 주면 `string`이다. 이는 `@types/node`가 **함수 오버로드**로 선언해 둔 덕분이다.

```typescript
import { readFile } from "node:fs/promises";

const buf = await readFile("data.bin");          // Buffer
const txt = await readFile("data.txt", "utf-8"); // string
const txt2 = await readFile("data.txt", {
  encoding: "utf-8",
});                                               // string
```

`buf`는 `Buffer`, `txt`는 `string`으로 정확히 추론된다. 호출 형태만으로 컴파일러가 올바른 오버로드를 골라 주므로, `as string` 같은 단언이 필요 없다. 이진 데이터인지 텍스트인지가 타입에 그대로 드러난다.

![fs / path 타이핑](/assets/posts/ts-typing-fs-path-flow.svg)

## callback과 promises, 그리고 sync

`fs`는 세 가지 스타일을 제공한다. 콜백 기반(`fs`), 프라미스 기반(`fs/promises`), 동기(`*Sync`)다. 현대 코드에서는 `node:fs/promises`를 기본으로 쓰는 것이 가장 깔끔하다.

```typescript
import * as fs from "node:fs/promises";
import { readFileSync } from "node:fs";

const data = await fs.readFile("a.txt", "utf-8"); // Promise 기반
const sync = readFileSync("a.txt", "utf-8");      // 동기, string

await fs.writeFile("out.txt", "내용", "utf-8");
const entries = await fs.readdir("./dir", { withFileTypes: true });
// entries: Dirent[] — 옵션이 반환 타입을 바꾼다
```

`readdir`도 오버로드의 좋은 예다. 옵션 없이는 `string[]`을, `{ withFileTypes: true }`를 주면 `Dirent[]`를 반환한다. 옵션 객체가 반환 타입을 결정하므로, `entry.isDirectory()` 같은 메서드를 안전하게 부를 수 있다.

![인코딩에 따른 반환 타입](/assets/posts/ts-typing-fs-path-code.svg)

## path 모듈과 플랫폼

`path`는 모든 함수가 `string`을 다루지만, 플랫폼별 구분이 타입에 들어 있다. `path` 자체는 OS 기본 구분자를 쓰고, `path.posix`/`path.win32`로 특정 규칙을 강제할 수 있다.

```typescript
import path from "node:path";

const full: string = path.join("src", "lib", "index.ts");
const ext: string = path.extname(full);          // ".ts"
const parsed = path.parse(full);
// parsed: { root, dir, base, ext, name } — 모두 string

const url = path.posix.join("a", "b");           // 항상 "a/b" (슬래시)
```

`path.parse`의 반환 타입은 `ParsedPath` 객체로, 각 조각이 명확한 필드로 나뉜다. 문자열을 직접 자르는 대신 이 타입을 쓰면 경로 파싱 로직이 안전해진다.

## Stats와 에러 코드 좁히기

파일 메타데이터를 다루는 `stat`은 `Stats` 객체를 돌려준다. 그리고 파일 시스템 에러는 `unknown`으로 잡힌 뒤 좁히기로 코드별 분기를 한다.

```typescript
import { stat } from "node:fs/promises";

try {
  const s = await stat("maybe.txt"); // Stats
  if (s.isFile()) console.log(`${s.size} bytes`);
} catch (e) {
  // catch의 e는 unknown — 좁혀서 써야 한다
  if (
    e instanceof Error &&
    "code" in e &&
    (e as NodeJS.ErrnoException).code === "ENOENT"
  ) {
    console.log("파일이 없습니다");
  } else {
    throw e;
  }
}
```

`catch (e)`의 `e`는 `unknown`이므로, `instanceof Error`와 `code` 속성 확인으로 좁힌 뒤에야 안전하게 다룰 수 있다. `NodeJS.ErrnoException`은 `@types/node`가 제공하는, `code`·`errno`·`syscall` 필드를 가진 에러 타입이다. `"ENOENT"`(없음), `"EACCES"`(권한) 같은 코드로 분기하면 견고한 파일 처리가 된다.

정리하면, `fs`·`path` 타이핑의 핵심은 ① 인코딩·옵션 인자가 반환 타입을 바꾸는 오버로드를 이해하고 ② `fs/promises`를 기본으로 쓰며 ③ `path`의 구조화된 반환 타입을 활용하고 ④ 에러는 `unknown`에서 코드별로 좁히는 것이다. 같은 "오버로드로 반환 타입을 분기"하는 패턴은 다음 글의 HTTP 핸들러 타이핑에서도 다시 등장한다.

---

**지난 글:** [Node.js 코어 타이핑 — @types/node와 내장 모듈](/posts/ts-typing-node-core/)

**다음 글:** [HTTP 핸들러 타이핑 — 요청·응답에 타입 입히기](/posts/ts-typing-http-handlers/)

<br>
읽어주셔서 감사합니다. 😊
