---
title: "Docker Compose extends와 merge: 설정 재사용과 공통 베이스"
description: "Compose extends로 서비스 설정을 상속하는 방법, -f 플래그로 여러 파일을 병합하는 패턴, scalar/mapping 키별 merge 규칙을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "extends", "merge", "설정재사용", "공통베이스"]
featured: false
draft: false
---

[지난 글](/posts/compose-profiles/)에서 profiles로 환경별 서비스를 분리했다. 이번에는 `extends`와 파일 병합으로 공통 설정을 재사용하는 방법을 정리한다.

## extends — 서비스 단위 상속

`extends`는 다른 서비스의 설정을 상속해서 중복을 줄인다. 같은 이미지로 여러 서비스를 실행하되 `command`나 `ports`만 다를 때 유용하다.

```yaml
# base.yaml — 공통 설정 모음
services:
  base-service:
    image: my-app:latest
    env_file: .env
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
```

```yaml
# compose.yaml — 실제 서비스들
services:
  web:
    extends:
      file: base.yaml
      service: base-service
    ports:
      - "80:3000"
    command: npm start

  worker:
    extends:
      file: base.yaml
      service: base-service
    command: npm run worker
    environment:
      QUEUE: jobs
```

`file`을 생략하면 같은 `compose.yaml` 안의 서비스를 참조한다.

![extends 다이어그램](/assets/posts/compose-extends-merge-diagram.svg)

## merge 규칙

extends로 가져온 설정과 자식 서비스의 설정이 충돌할 때 적용 규칙이 키 종류마다 다르다.

**scalar 값 (image, command, restart 등):** 자식이 부모를 덮어쓴다.

```yaml
# base: restart: always
# child: restart: on-failure
# 결과: restart: on-failure  (자식 우선)
```

**mapping/list (environment, labels, ports 등):** 부모와 자식이 합산된다.

```yaml
# base: environment: {LOG_LEVEL: info}
# child: environment: {QUEUE: jobs}
# 결과: environment: {LOG_LEVEL: info, QUEUE: jobs}
```

같은 키가 있으면 자식 값이 부모를 덮어쓴다.

**미지원 필드:** `networks`, `volumes`, `depends_on`, `deploy`는 extends로 상속되지 않는다. 자식 서비스에 직접 선언해야 한다.

## -f 플래그로 파일 병합

`-f`로 여러 파일을 지정하면 Compose가 병합해서 최종 설정을 만든다. 뒤에 오는 파일이 앞 파일을 덮어쓴다.

```bash
docker compose -f compose.yaml -f compose.dev.yaml up
```

```yaml
# compose.yaml
services:
  api:
    image: my-api
    environment:
      LOG_LEVEL: warn

# compose.dev.yaml
services:
  api:
    environment:
      LOG_LEVEL: debug    # warn을 debug로 덮어씀
    volumes:
      - .:/app            # 소스 코드 마운트 추가
```

![extends 코드 예시](/assets/posts/compose-extends-merge-code.svg)

병합 결과를 확인하려면 `config` 명령을 쓴다.

```bash
docker compose -f compose.yaml -f compose.dev.yaml config
```

## extends vs -f 병합 비교

| 기준 | extends | -f 병합 |
|------|---------|---------|
| 단위 | 서비스 단위 | 전체 파일 |
| 사용 시점 | 같은 이미지 다른 role | 환경별 설정 분리 |
| merge 범위 | networks·volumes 제외 | 전체 키 |
| 구성 위치 | compose.yaml 내 선언 | CLI 인수 |

대규모 프로젝트에서는 두 방법을 함께 쓴다. `base.yaml`에 공통 서비스 설정을 `extends`로 공유하고, `compose.dev.yaml`·`compose.prod.yaml`로 환경별 차이를 `-f`로 병합한다.

## 주의 사항

`extends`는 순환 참조를 허용하지 않는다. A가 B를 extends하고 B가 A를 extends하면 오류가 발생한다.

`depends_on`은 extends에서 상속되지 않는다. 자식 서비스마다 직접 선언해야 한다. 이는 의도적 설계로, 의존 관계는 환경마다 달라질 수 있기 때문이다.

---

**지난 글:** [Docker Compose profiles: 환경별 서비스 선택 실행](/posts/compose-profiles/)

**다음 글:** [Docker Compose override: 환경별 설정 재정의 패턴](/posts/compose-override/)

<br>
읽어주셔서 감사합니다. 😊
