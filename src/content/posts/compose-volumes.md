---
title: "Docker Compose volumes: named volume, bind mount, tmpfs"
description: "compose.yaml의 volumes 키 아래 named volume, bind mount, tmpfs 세 가지 유형과 external 볼륨, 장형식 선언 방법을 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "volumes", "named-volume", "bind-mount", "tmpfs", "external"]
featured: false
draft: false
---

[지난 글](/posts/compose-build-vs-image/)에서 `build`와 `image`의 차이를 살펴봤다. 이번에는 `compose.yaml`에서 볼륨을 다루는 방법을 세 가지 유형으로 나눠 정리한다.

## 세 가지 볼륨 유형

![볼륨 유형 비교](/assets/posts/compose-volumes-types.svg)

### Named Volume — 데이터 영속성

```yaml
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:   # 최상위에 선언 필수
```

`pgdata`는 `/var/lib/docker/volumes/프로젝트명_pgdata`에 저장된다. `docker compose down`으로 컨테이너를 제거해도 볼륨은 남는다. 데이터를 삭제하려면 `docker compose down -v`를 써야 한다.

### Bind Mount — 호스트 경로 직접 마운트

```yaml
services:
  api:
    volumes:
      - ./src:/app/src          # 소스 코드 hot reload
      - ./config:/app/config:ro # 설정 파일 읽기 전용
```

호스트의 실제 경로를 컨테이너 안으로 마운트한다. 코드 변경이 즉시 컨테이너에 반영되어 개발 환경에서 많이 쓴다. 프로덕션에서는 파일 권한, 경로 의존성 문제로 비권장이다.

### tmpfs — 메모리 기반 임시 스토리지

```yaml
services:
  api:
    tmpfs:
      - /app/tmp          # 단축형

    # 장형식 (더 많은 옵션)
    volumes:
      - type: tmpfs
        target: /app/sessions
        tmpfs:
          size: 134217728   # 128MB 제한
```

컨테이너 종료 시 데이터가 사라진다. 세션 파일, 캐시, 임시 업로드 처리 등에 쓴다.

## 장형식 볼륨 선언

단축형(`source:target`)보다 옵션이 많을 때는 장형식을 쓴다.

```yaml
services:
  api:
    volumes:
      - type: bind
        source: ./src
        target: /app/src
        read_only: false
        bind:
          create_host_path: true   # 호스트 경로 없으면 자동 생성
```

![볼륨 고급 옵션](/assets/posts/compose-volumes-advanced.svg)

## 볼륨 공유: 여러 서비스에서 같은 볼륨 사용

```yaml
services:
  writer:
    image: myapp-writer
    volumes:
      - shared-data:/data

  reader:
    image: myapp-reader
    volumes:
      - shared-data:/data:ro   # 읽기 전용으로 공유

volumes:
  shared-data:
```

여러 컨테이너가 같은 named volume을 마운트할 수 있다. 동시 쓰기 충돌에 주의한다.

## external: 기존 볼륨 참조

Compose가 볼륨을 생성하지 않고 이미 존재하는 볼륨을 참조할 때 쓴다.

```yaml
volumes:
  prod-db:
    external: true            # 이미 존재해야 함
    name: myapp_prod_pgdata   # 실제 볼륨 이름 (optional)
```

`external: true`인 볼륨이 없으면 `docker compose up` 시 오류가 발생한다. 스테이징·프로덕션 환경에서 미리 생성된 볼륨을 안전하게 참조할 때 유용하다.

## node_modules 분리 패턴

호스트의 `node_modules`가 컨테이너 안으로 들어오지 않도록 하는 표준 패턴이다.

```yaml
services:
  app:
    build: .
    volumes:
      - ./src:/app/src                    # 소스 코드 마운트
      - node_modules:/app/node_modules    # 컨테이너 안 node_modules 보존

volumes:
  node_modules:
```

호스트의 `node_modules`(macOS, Windows 바이너리)가 리눅스 컨테이너와 충돌하는 문제를 막는다.

## 볼륨 관련 명령

```bash
# 현재 프로젝트의 볼륨 목록
docker compose ls

# 볼륨 내용 확인 (임시 컨테이너)
docker run --rm -v pgdata:/data alpine ls /data

# 볼륨 백업
docker run --rm \
  -v pgdata:/source \
  -v $(pwd):/backup \
  alpine tar czf /backup/pgdata.tar.gz -C /source .

# 볼륨 삭제 (데이터 영구 삭제 주의)
docker compose down -v
docker volume rm myapp_pgdata
```

## 정리

- Named volume은 Docker가 관리, 데이터 영속성 보장, `down -v`로만 삭제된다.
- Bind mount는 호스트 경로 직접 마운트, 개발 hot reload에 적합하다.
- tmpfs는 메모리 기반 임시 저장소, 컨테이너 종료 시 데이터가 사라진다.
- `external: true`로 기존 볼륨을 Compose에서 참조할 수 있다.
- `node_modules` 분리는 크로스 플랫폼 개발 환경의 표준 패턴이다.

---

**지난 글:** [Docker Compose build vs image](/posts/compose-build-vs-image/)

**다음 글:** [Docker Compose networks](/posts/compose-networks/)

<br>
읽어주셔서 감사합니다. 😊
