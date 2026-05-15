---
title: "ENV vs ARG: 환경변수와 빌드 인수"
description: "Dockerfile ENV와 ARG의 스코프 차이(빌드 타임 vs 런타임), 이미지 포함 여부, ARG→ENV 전달 패턴, FROM 전 ARG 특수 규칙, 보안 고려사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 6
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "ENV", "ARG", "환경변수", "빌드인수", "보안"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-workdir/)에서 작업 디렉터리를 설정하는 WORKDIR을 살펴봤다. 이번에는 Dockerfile에서 값을 주입하는 두 인스트럭션, `ENV`와 `ARG`의 차이를 깊이 분석한다.

## 핵심 차이: 언제 살아있는가

두 인스트럭션의 가장 큰 차이는 **생명주기**다.

- `ARG` — 빌드 시(`docker build`)에만 존재하고, 이미지에 포함되지 않는다
- `ENV` — 빌드 시와 런타임 모두 존재하고, 이미지에 포함된다

![ENV vs ARG 스코프 비교](/assets/posts/dockerfile-env-arg-scope.svg)

## ARG — 빌드 타임 인수

```dockerfile
# 기본값 지정 (선택)
ARG NODE_VERSION=20
ARG BUILD_DATE

FROM node:${NODE_VERSION}-alpine

# 빌드 시 오버라이드
# docker build --build-arg NODE_VERSION=18 .
```

`ARG`로 선언한 값은 `RUN`, `COPY`, `WORKDIR` 등 인스트럭션 안에서 `$변수명` 또는 `${변수명}` 형식으로 참조할 수 있다. 빌드가 끝나면 이미지에 남지 않는다.

### FROM 전 ARG 특수 규칙

```dockerfile
# FROM 앞에서 선언한 ARG는 FROM 안에서만 유효
ARG BASE=node:20-alpine
FROM $BASE

# FROM 이후 새로운 스코프 시작 — 재선언 없으면 값 없음
ARG BASE          # 재선언해야 이전 값 복원
RUN echo $BASE    # node:20-alpine 출력
```

`FROM` 이전의 `ARG`는 `FROM` 인스트럭션 안에서만 참조 가능하다. `FROM` 이후에서 같은 변수를 쓰려면 **재선언**이 필요하다.

## ENV — 빌드 + 런타임 환경 변수

```dockerfile
# 단일 변수
ENV PORT=3000

# 복수 변수 (권장: 한 레이어로 합치기)
ENV PORT=3000 \
    NODE_ENV=production \
    LOG_LEVEL=info
```

`ENV`는 이미지에 영구 저장된다. 컨테이너 실행 시 자동으로 환경 변수로 노출되며, `docker run -e PORT=8080`으로 오버라이드할 수 있다.

## 실전 패턴

![ENV / ARG 실전 패턴](/assets/posts/dockerfile-env-arg-patterns.svg)

### ARG → ENV 전달 패턴

```dockerfile
# 빌드 인수로 받아서 런타임 환경 변수로 이어주기
ARG APP_VERSION=1.0.0
ENV APP_VERSION=$APP_VERSION

# 결과: 컨테이너 안에서 echo $APP_VERSION → 1.0.0
```

이 패턴은 버전 정보나 빌드 타임 설정을 런타임까지 전달할 때 자주 쓰인다.

### ENV 변수를 이후 인스트럭션에서 참조

```dockerfile
ENV APP_HOME=/app
WORKDIR $APP_HOME
COPY --chown=node:node . $APP_HOME
RUN ls $APP_HOME
```

`ENV`로 설정한 변수는 이후 모든 인스트럭션에서 참조 가능하다. 경로를 변수로 중앙화하면 수정 시 한 곳만 바꾸면 된다.

## 보안: 민감 정보를 넣지 마라

```dockerfile
# 위험: 이미지 레이어 히스토리에 노출됨
ENV DB_PASSWORD=supersecret
ARG PRIVATE_KEY=abc123

# 확인 방법
# docker history myimage --no-trunc
```

`ENV`는 이미지에 영구히 남아 `docker inspect`나 `docker history`로 노출된다. `ARG`도 빌드 레이어 히스토리에 기록된다. **비밀번호·API 키·토큰은 ENV/ARG에 절대 넣지 않는다**.

대신 다음 방법을 사용한다.

```dockerfile
# BuildKit 비밀 주입 — 이미지에 남지 않음
RUN --mount=type=secret,id=db_pass \
    cat /run/secrets/db_pass | ./configure.sh
```

```bash
# 빌드 시
docker build --secret id=db_pass,src=.env .
```

런타임 비밀은 `docker run -e` 또는 Docker Secrets(Swarm/Compose)로 주입한다.

## 캐시에 미치는 영향

```dockerfile
ARG BUILD_DATE
# docker build --build-arg BUILD_DATE=$(date) .
# → BUILD_DATE가 바뀔 때마다 이후 레이어 모두 무효화
RUN npm ci
```

`ARG` 값이 바뀌면 해당 ARG 이후 레이어가 캐시 무효화된다. 자주 변경되는 값(타임스탬프, 커밋 해시)은 Dockerfile 하단에 배치해 불필요한 재빌드를 피한다.

## 선택 기준 정리

| 상황 | 사용 |
|---|---|
| 빌드 시에만 필요한 설정 | `ARG` |
| 런타임에도 필요한 환경 변수 | `ENV` |
| CI에서 동적으로 주입하는 버전 정보 | `ARG` → `ENV` 전달 |
| 민감 정보 (비밀번호, 토큰) | BuildKit secret / 런타임 주입 |
| 베이스 이미지 버전 동적 설정 | `ARG` (FROM 앞에) |

---

**지난 글:** [WORKDIR 인스트럭션 완전 정복](/posts/dockerfile-workdir/)

**다음 글:** [CMD vs ENTRYPOINT: 컨테이너 시작 명령](/posts/dockerfile-cmd-vs-entrypoint/)

<br>
읽어주셔서 감사합니다. 😊
