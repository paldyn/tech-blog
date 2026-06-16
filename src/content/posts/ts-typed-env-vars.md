---
title: "환경 변수 타이핑 — process.env 안전하게 다루기"
description: "process.env의 string | undefined 함정을 스키마 검증으로 막는 법을 정리합니다. 기본 타입의 한계, ProcessEnv 전역 보강의 위험, Zod 기반 파싱과 형 변환, 앱 시작 시 검증으로 fail-fast 하는 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "환경변수", "process.env", "스키마검증", "Zod", "Node"]
featured: false
draft: false
---

[지난 글](/posts/ts-dependency-injection-typing/)에서 의존성을 타입 안전하게 주입하는 법을 봤다. 그 의존성들이 설정값을 어디서 받는지 따라가면 대개 환경 변수에 닿는다. `process.env`는 애플리케이션 경계 바깥에서 들어오는 신뢰할 수 없는 입력인데, TypeScript에서 가장 흔히 방치되는 타입 구멍이기도 하다. 이번 글은 `process.env`의 함정을 짚고, 시작 시점에 한 번 검증해 이후로는 안전하게 쓰는 패턴을 정리한다.

## process.env의 진짜 타입

`@types/node`가 선언하는 `process.env`의 타입은 `Record<string, string | undefined>`다. 즉 **모든 키가 `undefined`일 수 있고, 모든 값이 문자열**이다.

```typescript
const port = process.env.PORT;     // string | undefined
const n = Number(port);            // undefined면 NaN
listen(n);                         // NaN으로 조용히 망가진다

const mode = process.env.NODE_ENV; // string | undefined — 오타도 못 잡음
```

두 가지 문제가 보인다. 첫째, 값이 없을 수 있는데(`undefined`) 그걸 처리하지 않으면 `Number(undefined)`가 `NaN`이 되어 조용히 번진다. 둘째, 모든 값이 `string`이라 숫자·불리언으로 바로 쓸 수 없고 매번 변환해야 한다.

![환경 변수 타이핑](/assets/posts/ts-typed-env-vars-flow.svg)

## 전역 보강의 유혹과 함정

흔히 `ProcessEnv` 인터페이스를 전역 보강해 키를 선언하는 방법을 쓴다. 자동완성은 되지만, 위험한 거짓말이다.

```typescript
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string;      // undefined를 숨겼지만...
      NODE_ENV: "development" | "production";
    }
  }
}

const port = process.env.PORT; // 타입은 string 이지만 런타임엔 여전히 undefined 가능
```

이 선언은 `PORT`가 항상 `string`이라고 주장하지만, **런타임에서 검증하지 않으므로** 실제로 환경 변수가 없으면 여전히 `undefined`다. 타입과 현실이 어긋나는 전형적인 거짓 단언이다. 타입만 칠해서는 안 되고, 런타임 검증이 함께 가야 한다.

## 스키마로 검증하며 변환하기

견고한 해법은 앱 시작 시 스키마로 `process.env`를 검증하고, 그 결과를 단일 객체로 노출하는 것이다. Zod의 `coerce`를 쓰면 문자열을 숫자·불리언으로 변환까지 한 번에 처리한다.

```typescript
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().url(),
  ENABLE_CACHE: z.coerce.boolean().default(false),
});

export const env = EnvSchema.parse(process.env);
// env.PORT: number, env.NODE_ENV: "development" | ..., 모두 검증·변환 완료
```

`env.PORT`는 이제 `number`이고, `NODE_ENV`는 정확히 세 리터럴 중 하나로 좁혀진다. `z.infer<typeof EnvSchema>`로 타입을 자동 도출할 수도 있으니, 스키마가 타입과 검증의 **단일 진실 공급원**이 된다.

![검증된 환경 변수](/assets/posts/ts-typed-env-vars-code.svg)

## 시작 시점에 fail-fast

이 패턴의 가장 큰 이점은 잘못된 설정이 **즉시** 드러난다는 것이다. `parse`는 검증 실패 시 던지므로, 앱이 부팅하다가 바로 멈춘다.

```typescript
// src/env.ts — 진입점에서 가장 먼저 import 한다
const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ 잘못된 환경 변수:");
  console.error(result.error.flatten().fieldErrors);
  process.exit(1); // 부팅 중단 — 운영 중 터지는 것보다 낫다
}

export const env = result.data;
```

`safeParse`로 받아 실패 시 어떤 변수가 왜 틀렸는지 출력하고 종료한다. `DATABASE_URL`이 빠진 채 배포됐다면, 트래픽을 받기 전에 부팅 단계에서 멈춘다. 운영 중 첫 요청에서 `undefined`로 터지는 것보다 훨씬 안전하다.

## 사용처에서는 env 객체만 본다

검증을 통과한 뒤로는 코드 어디서도 `process.env`를 직접 만지지 않는다. 오직 타입이 보장된 `env` 객체만 import한다.

```typescript
import { env } from "./env";

server.listen(env.PORT);                    // number, 보장됨
if (env.NODE_ENV === "production") enableMetrics();
const db = connect(env.DATABASE_URL);       // 검증된 URL
```

`process.env`라는 신뢰할 수 없는 입구를 한 곳으로 모으고, 나머지 코드는 깨끗한 타입만 소비한다.

정리하면, 환경 변수 안전성의 핵심은 ① `string | undefined`라는 현실을 인정하고 ② 타입만 칠하는 전역 보강에 기대지 말며 ③ 시작 시점에 스키마로 검증·변환해 ④ 실패하면 즉시 멈추는 것이다. 이는 앞서 본 "외부 입력은 검증 전까지 신뢰하지 않는다"는 원칙의 또 다른 적용이다. 다음 글부터는 Node.js 자체의 타입, 즉 `@types/node`와 내장 모듈 타이핑으로 들어간다.

---

**지난 글:** [의존성 주입 타이핑 — 토큰과 컨테이너 설계](/posts/ts-dependency-injection-typing/)

**다음 글:** [Node.js 코어 타이핑 — @types/node와 내장 모듈](/posts/ts-typing-node-core/)

<br>
읽어주셔서 감사합니다. 😊
