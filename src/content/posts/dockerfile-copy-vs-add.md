---
title: "COPY vs ADD: 무엇을 써야 하는가"
description: "Dockerfile COPY와 ADD 인스트럭션의 기능 차이, --chown·--from 옵션 활용, tar 자동 압축 해제와 URL 다운로드 시 주의사항, 실전 권장 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "COPY", "ADD", "파일복사", "멀티스테이지", "chown"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-run/)에서 RUN으로 명령을 실행해 레이어를 만드는 방법을 살펴봤다. 이번에는 빌드 컨텍스트의 파일을 이미지 안으로 옮기는 `COPY`와 `ADD`를 비교한다.

## 두 인스트럭션의 공통점

`COPY`와 `ADD` 모두 **소스 파일을 이미지 레이어에 추가**한다. 기본 문법도 같다.

```dockerfile
COPY <src> <dest>
ADD  <src> <dest>
```

`<src>`는 빌드 컨텍스트 기준의 상대 경로, `<dest>`는 이미지 내 절대 경로(또는 `WORKDIR` 기준 상대 경로)다.

## 기능 비교

![COPY vs ADD 기능 비교](/assets/posts/dockerfile-copy-vs-add-comparison.svg)

핵심 차이는 두 가지다.

1. **`ADD`는 URL에서 파일을 내려받을 수 있다** — `COPY`는 로컬 파일만 다룬다.
2. **`ADD`는 tar 아카이브를 자동으로 압축 해제한다** — `.tar`, `.tar.gz`, `.tar.bz2` 등을 `<dest>`에 자동으로 풀어 넣는다.

## 실전 사용 패턴

![COPY / ADD 실전 사용 패턴](/assets/posts/dockerfile-copy-vs-add-code.svg)

### COPY — 기본 선택

```dockerfile
# 특정 파일만 복사
COPY package.json package-lock.json ./

# 전체 디렉터리 복사 (.dockerignore 적용됨)
COPY . .

# 소유권 변경하며 복사 (루트가 아닌 사용자에게)
COPY --chown=node:node . .
```

명시적이고 예측 가능하다. 빌드 컨텍스트의 파일을 그대로 가져오는 경우 항상 `COPY`를 쓴다.

### COPY --from: 멀티 스테이지 빌드

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /src
COPY . .
RUN go build -o app .

FROM distroless/base
# 이전 스테이지에서 바이너리만 가져오기
COPY --from=builder /src/app /app
CMD ["/app"]
```

`--from=<스테이지명>` 또는 `--from=<인덱스>`를 쓰면 다른 스테이지의 파일시스템에서 직접 가져올 수 있다. 이 기능은 `ADD`에는 없다.

### ADD — tar 압축 해제가 필요할 때

```dockerfile
# rootfs.tar.gz를 / 에 풀어서 베이스 파일시스템 구성
ADD rootfs.tar.gz /

# kernel 소스 추가 후 빌드 환경 구성
ADD linux-6.6.tar.xz /usr/src/
```

`ADD`의 tar 자동 해제는 베이스 파일시스템을 구성하거나, 대형 아카이브를 디렉터리로 풀 때 편리하다. **이 용도 외에는 COPY를 쓴다**.

### URL 다운로드 — RUN curl이 더 안전

```dockerfile
# ADD로 URL 다운로드 — 검증 불가, 캐시 제어 어려움
ADD https://example.com/tool /usr/local/bin/tool

# 권장: RUN curl + 체크섬 검증
RUN curl -fsSL https://example.com/tool -o /usr/local/bin/tool && \
    echo "abc123  /usr/local/bin/tool" | sha256sum -c && \
    chmod +x /usr/local/bin/tool
```

`ADD`의 URL 지원은 체크섬 검증이 없고, 원격 콘텐츠가 바뀌어도 레이어 캐시가 무효화되지 않는 경우가 있어 위험하다. `RUN curl`에 sha256 검증을 붙이는 패턴이 훨씬 안전하다.

## --chown 옵션 상세

```dockerfile
# 숫자 UID/GID 사용
COPY --chown=1000:1000 . .

# 이름 사용 (이미지에 해당 사용자가 존재해야 함)
COPY --chown=appuser:appgroup config/ /etc/app/

# 사용자만 지정 (그룹은 동일)
COPY --chown=node . .
```

`--chown` 없이 복사하면 파일 소유자가 **root(0:0)** 가 된다. 컨테이너에서 비루트 사용자로 실행할 계획이라면 복사 시점에 소유권을 설정하는 게 효율적이다(나중에 `RUN chown -R`을 쓰면 별도 레이어가 생긴다).

## 결정 기준 요약

| 상황 | 사용 인스트럭션 |
|---|---|
| 로컬 파일/디렉터리 복사 | `COPY` |
| 멀티 스테이지에서 파일 가져오기 | `COPY --from` |
| 소유권 변경하며 복사 | `COPY --chown` |
| tar 아카이브 압축 해제 | `ADD` |
| URL에서 파일 다운로드 | `RUN curl` + 체크섬 |

`ADD`는 tar 해제라는 한 가지 특수 목적에만 쓰고, 나머지는 모두 `COPY`를 선택하는 것이 Docker 공식 베스트 프랙티스다.

---

**지난 글:** [RUN 인스트럭션 완전 정복](/posts/dockerfile-run/)

**다음 글:** [WORKDIR 인스트럭션 완전 정복](/posts/dockerfile-workdir/)

<br>
읽어주셔서 감사합니다. 😊
