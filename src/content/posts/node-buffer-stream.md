---
title: "Buffer & Stream · 바이너리 데이터와 스트리밍"
description: "Node.js Buffer 클래스의 생성·변환·조작 방법, Readable·Writable·Transform·Duplex 스트림 타입, stream/promises.pipeline 사용법, 백프레셔(backpressure) 처리, 커스텀 스트림 구현을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Node.js", "Buffer", "Stream", "pipeline", "백프레셔", "Transform", "Readable"]
featured: false
draft: false
---

[지난 글](/posts/node-fs-path-os/)에서 `fs`, `path`, `os` 모듈을 살펴봤습니다. 이번에는 Node.js에서 바이너리 데이터를 다루는 **Buffer**와 대용량 데이터를 효율적으로 처리하는 **Stream**을 깊이 살펴봅니다.

---

## Buffer — 고정 크기 바이너리 데이터

JavaScript는 전통적으로 바이너리 데이터를 직접 다루는 방법이 없었습니다. Node.js는 이를 위해 `Buffer` 클래스를 도입했습니다. Buffer는 `Uint8Array`를 상속하므로 TypedArray API를 모두 사용할 수 있습니다.

![Buffer 구조와 인코딩](/assets/posts/node-buffer-stream-buffer.svg)

---

## Buffer 생성

```js
// 1. alloc — 0으로 초기화된 Buffer 생성 (보안적으로 안전)
const buf1 = Buffer.alloc(16);
const buf2 = Buffer.alloc(8, 0xFF); // 0xFF로 채움

// 2. from — 다양한 소스에서 생성
const buf3 = Buffer.from('Hello, 안녕', 'utf-8');
const buf4 = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
const buf5 = Buffer.from(buf3); // 복사
const buf6 = Buffer.from(buf3.buffer, buf3.byteOffset, buf3.byteLength); // 공유 메모리

// 3. allocUnsafe — 초기화 없음 (빠르지만 기존 메모리 내용 포함 가능)
// 민감한 데이터가 노출될 수 있으므로 즉시 덮어쓸 때만 사용
const buf7 = Buffer.allocUnsafe(1024);
buf7.fill(0); // 직접 초기화
```

---

## Buffer 조작

```js
const buf = Buffer.from('Node.js');

// 인덱스 접근
console.log(buf[0]);       // 78 (0x4E, 'N'의 ASCII)
buf[0] = 0x6E;             // 'N' → 'n' 변경

// 슬라이스 (메모리 공유)
const slice = buf.slice(0, 4); // buf와 메모리 공유 (Node.js 전통)
const copy  = buf.subarray(0, 4); // 같은 효과, 표준 TypedArray 메서드

// 읽기/쓰기 (엔디안 명시)
buf.writeUInt32BE(0x12345678, 0);
console.log(buf.readUInt32BE(0)); // 305419896

// 비교 / 검색
const a = Buffer.from('abc');
const b = Buffer.from('abd');
Buffer.compare(a, b); // -1 (a < b)
a.indexOf('b');       // 1

// 연결
const merged = Buffer.concat([a, b], a.length + b.length);
```

---

## Stream 4가지 타입

![Stream 파이프라인](/assets/posts/node-buffer-stream-stream.svg)

| 타입 | 역할 | 예시 |
|------|------|------|
| Readable | 데이터 읽기 | `fs.createReadStream`, `http.IncomingMessage` |
| Writable | 데이터 쓰기 | `fs.createWriteStream`, `http.ServerResponse` |
| Transform | 변환 (읽기+쓰기) | `zlib.createGzip`, `crypto.createCipher` |
| Duplex | 독립적 읽기+쓰기 | `net.Socket`, `WebSocket` |

---

## pipeline — 스트림 연결

```js
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { createCipher, createDecipher } from 'crypto';

// 파일 암호화 + 압축
await pipeline(
  createReadStream('./secret.txt'),
  createCipher('aes-256-cbc', 'passphrase'),
  createGzip(),
  createWriteStream('./secret.enc.gz')
);

// 복호화 + 압축 해제
await pipeline(
  createReadStream('./secret.enc.gz'),
  createGunzip(),
  createDecipher('aes-256-cbc', 'passphrase'),
  createWriteStream('./secret-decrypted.txt')
);
```

`pipeline`은 `.pipe()`와 달리 에러가 발생하면 **모든 스트림을 자동으로 정리**합니다. 백프레셔(backpressure)도 자동으로 처리합니다.

---

## 백프레셔 (Backpressure)

Readable이 Writable보다 빠르면 메모리에 데이터가 쌓입니다. `pipeline`이 자동으로 처리하지만, 수동으로 구현할 때는 `drain` 이벤트를 사용합니다.

```js
const readable = createReadStream('./big-file.csv');
const writable = createWriteStream('./output.csv');

readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);
  if (!canContinue) {
    readable.pause(); // 쓰기 버퍼가 가득 참 → 읽기 일시 중단
  }
});

writable.on('drain', () => {
  readable.resume(); // 버퍼 비워짐 → 읽기 재개
});

readable.on('end', () => writable.end());
```

---

## 커스텀 Transform 스트림

```js
import { Transform } from 'stream';

class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    // chunk는 Buffer, encoding은 'buffer' 또는 인코딩 이름
    const upper = chunk.toString().toUpperCase();
    this.push(upper); // 다음 스트림으로 전달
    callback();       // 처리 완료 신호
  }

  _flush(callback) {
    // 스트림 끝에서 마지막 데이터 처리
    this.push('--- END ---\n');
    callback();
  }
}

await pipeline(
  createReadStream('./input.txt'),
  new UpperCaseTransform(),
  createWriteStream('./output.txt')
);
```

---

## Readable 스트림 직접 소비

```js
import { createReadStream } from 'fs';

// 방법 1: for await...of (권장)
const stream = createReadStream('./data.csv', { encoding: 'utf-8' });
let content = '';
for await (const chunk of stream) {
  content += chunk;
}

// 방법 2: Readable.toWeb() — Web Streams API 변환 (Node 17+)
const webStream = createReadStream('./data').pipe(new Transform({
  transform(chunk, _, cb) { cb(null, chunk); }
}));

// 방법 3: 전체 버퍼로 읽기 (소용량)
import { readFile } from 'fs/promises';
const buf = await readFile('./data.bin'); // Buffer 반환
```

---

## TextDecoder / TextEncoder (Node 내장)

```js
// Buffer ↔ 문자열 변환에서 인코딩 명시
const encoder = new TextEncoder(); // 항상 UTF-8
const decoder = new TextDecoder('euc-kr'); // 인코딩 지정 가능

const bytes = encoder.encode('안녕하세요');
console.log(decoder.decode(bytes));
```

---

**지난 글:** [fs · path · os · 파일 시스템과 환경 API](/posts/node-fs-path-os/)

**다음 글:** [http · https · http2 · Node.js 네트워크 서버](/posts/node-http-https-http2/)

<br>
읽어주셔서 감사합니다. 😊
