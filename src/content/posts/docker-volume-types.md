---
title: "Docker 볼륨 종류: Named, Anonymous, Bind Mount, tmpfs 비교"
description: "Docker 볼륨의 4가지 유형(Named Volume, Anonymous Volume, Bind Mount, tmpfs)을 특성·마운트 문법·사용 시점 기준으로 비교 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "volume", "bind mount", "tmpfs", "named volume", "anonymous volume"]
featured: false
draft: false
---

[지난 글](/posts/docker-volume-basics/)에서 볼륨이 왜 필요한지, 기본 명령어가 무엇인지 살펴봤다. 볼륨처럼 보이는 모든 마운트가 같은 방식으로 동작하지는 않는다. Docker에는 크게 4가지 마운트 유형이 있다. 각 유형의 특성을 이해하면 상황에 맞게 올바른 방법을 선택할 수 있다.

## 4가지 마운트 유형

![Docker 볼륨 4가지 유형 비교](/assets/posts/docker-volume-types-comparison.svg)

### Named Volume (이름 있는 볼륨)

Docker 데몬이 생성하고 관리하는 볼륨. 사람이 읽을 수 있는 이름을 부여해 재사용할 수 있다.

- 저장 위치: `/var/lib/docker/volumes/<name>/_data`
- 컨테이너 삭제 후에도 자동으로 유지됨
- `docker volume` 명령으로 생명주기 직접 제어 가능
- 여러 컨테이너가 같은 볼륨을 마운트할 수 있음

### Anonymous Volume (익명 볼륨)

이름 없이 자동 생성되는 볼륨. Docker가 SHA256 해시를 이름으로 부여한다.

- `-v /컨테이너경로` 처럼 호스트측 이름 없이 지정하거나 Dockerfile `VOLUME` 지시어로 생성
- 컨테이너 삭제 시 `--rm` 플래그가 있으면 함께 삭제됨
- 이름이 없어서 재사용이 어렵다 → 프로덕션에서는 Named Volume 선호

### Bind Mount (바인드 마운트)

호스트 파일시스템의 특정 경로를 컨테이너 내부에 그대로 연결한다.

- 절대 경로로 호스트 경로를 지정
- 호스트와 컨테이너가 실시간으로 파일을 공유
- 개발 중 소스 코드 변경을 즉시 컨테이너에 반영할 때 주로 사용
- 호스트 경로에 의존 → 다른 환경에서는 경로가 달라질 수 있음

### tmpfs (임시 파일 시스템)

호스트 메모리에만 존재하는 파일 시스템. 디스크에 아무것도 기록하지 않는다.

- 컨테이너 종료 시 데이터 완전 소멸
- 디스크 I/O 없이 빠른 읽기/쓰기
- 비밀번호, 세션 토큰 등 민감 임시 데이터에 적합
- Linux 호스트에서만 사용 가능

## 마운트 문법

![유형별 마운트 문법](/assets/posts/docker-volume-types-syntax.svg)

```bash
# -v 플래그로 유형 구분하는 법
docker run -v mydb:/var/lib/mysql mysql:8        # Named Volume (이름:경로)
docker run -v /host/path:/app node:20            # Bind Mount (/절대경로:경로)
docker run -v /app/cache node:20                 # Anonymous Volume (경로만)
docker run --tmpfs /tmp:rw,size=64m node:20      # tmpfs
```

`-v` 플래그에서:
- 콜론 앞부분이 `/`로 시작하면 **Bind Mount**
- 콜론 앞부분이 이름(슬래시 없음)이면 **Named Volume**
- 콜론 없이 경로만 지정하면 **Anonymous Volume**

`--mount` 플래그로 같은 것을 더 명확하게 쓸 수 있다.

```bash
# Named Volume
docker run --mount type=volume,source=mydb,target=/var/lib/mysql mysql:8

# Bind Mount
docker run --mount type=bind,source=/host/path,target=/app node:20

# tmpfs
docker run --mount type=tmpfs,target=/tmp,tmpfs-size=67108864 node:20
```

## 언제 어떤 것을 쓸까

| 상황 | 추천 유형 |
|------|-----------|
| DB 데이터, 업로드 파일 등 영속 데이터 | Named Volume |
| 개발 중 소스 코드 핫리로드 | Bind Mount |
| 설정 파일, 인증서 주입 | Bind Mount |
| Dockerfile VOLUME 선언 자동 생성 | Anonymous Volume |
| 세션 토큰, 임시 캐시 (보안 중요) | tmpfs |
| CI 빌드 캐시 (빠른 I/O 필요) | tmpfs |

## 읽기 전용 마운트

민감한 파일을 실수로 컨테이너가 수정하는 것을 막으려면 읽기 전용으로 마운트한다.

```bash
# -v 방식: :ro 추가
docker run -v ./config.yml:/app/config.yml:ro my-app

# --mount 방식: readonly 추가
docker run --mount type=bind,source=./config.yml,target=/app/config.yml,readonly my-app
```

## 핵심 정리

- Named Volume: Docker 관리, 이름 있음, 영속 → DB·파일 스토리지에 기본 선택
- Anonymous Volume: Docker 관리, 해시 이름, 컨테이너와 수명 연동 → 일회성 격리
- Bind Mount: 사용자 관리, 호스트 경로 직접 매핑 → 개발 환경에서 유용
- tmpfs: 메모리 기반, 컨테이너 종료 시 소멸 → 민감 임시 데이터

---

**지난 글:** [Docker 볼륨 기초: 데이터를 컨테이너 밖에서 관리하기](/posts/docker-volume-basics/)

**다음 글:** [Named Volume 완전 정복: 이름 있는 볼륨 생성·관리](/posts/docker-volume-named/)

<br>
읽어주셔서 감사합니다. 😊
