---
title: "docker image history — 이미지 레이어 이력 조회"
description: "docker image history 명령으로 이미지를 구성하는 레이어 목록과 각 레이어를 만든 Dockerfile 명령을 확인하는 방법, --no-trunc·--format·-q 옵션 활용, 레이어 크기 분석 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "image", "history", "레이어", "layer", "Dockerfile"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-rmi/)에서 이미지를 삭제하는 방법을 알아봤다. 이번에는 삭제하기 전에, 또는 이미지를 분석할 때 유용한 `docker image history` 명령을 살펴본다. 이 명령 하나로 이미지가 어떤 레이어로 구성되어 있는지, 각 레이어를 만든 Dockerfile 명령이 무엇인지, 얼마나 많은 용량을 차지하는지 파악할 수 있다.

## 기본 사용법

```bash
# 기본 history 조회
docker image history nginx:latest

# 짧은 형식 (동일)
docker history nginx:latest
```

출력은 **최신 레이어가 가장 위에**, 가장 오래된 베이스 레이어가 아래에 표시된다. Dockerfile 작성 순서(FROM → ... → CMD)와는 반대다.

## 출력 컬럼 해석

```text
IMAGE         CREATED       CREATED BY              SIZE
e5e16e1a5897  2 days ago    /bin/sh -c #(nop)…      0B
<missing>     2 days ago    /bin/sh -c nginx…        2.3MB
<missing>     2 days ago    /bin/sh -c apt-get…      45MB
```

| 컬럼 | 설명 |
|------|------|
| IMAGE | 레이어 ID (12자 축약). 최신 레이어만 이미지 ID와 일치 |
| CREATED | 레이어 생성 시점 |
| CREATED BY | 레이어를 만든 명령 (truncated) |
| SIZE | 해당 레이어가 추가한 용량 |
| COMMENT | 추가 메모 (거의 비어 있음) |

`<missing>`으로 표시되는 레이어는 다른 호스트에서 빌드된 레이어임을 의미한다. 로컬에서 빌드하면 모든 레이어에 ID가 표시된다.

![history 출력 해석](/assets/posts/docker-image-history-output.svg)

## --no-trunc: 전체 명령 보기

`CREATED BY` 컬럼은 기본적으로 잘린다. `--no-trunc` 옵션으로 전체 내용을 확인할 수 있다.

```bash
docker image history --no-trunc nginx:latest
```

Dockerfile의 `RUN` 명령 전체나 `COPY` 경로를 확인할 때 필수적이다. 출력이 길어지므로 파이프로 연결해서 보는 것이 편하다.

```bash
docker image history --no-trunc nginx:latest | less
```

## -q: ID만 출력

```bash
# 레이어 ID 목록만 출력
docker image history -q nginx:latest
```

스크립트에서 레이어 ID 목록이 필요할 때 사용한다. 단, `<missing>` 레이어는 빈 문자열로 출력된다.

## --format: 원하는 컬럼만 선택

Go 템플릿으로 필요한 필드만 추출할 수 있다.

```bash
# 크기와 명령만 출력
docker history --format \
  "{{.Size}}\t{{.CreatedBy}}" nginx:latest

# JSON 형식 출력
docker history --format '{{json .}}' nginx | jq .
```

사용 가능한 필드: `.ID`, `.CreatedSince`, `.CreatedAt`, `.CreatedBy`, `.Size`, `.Comment`

## Dockerfile 명령과 레이어 대응

```dockerfile
FROM  debian:bookworm-slim  # → Layer 1 (가장 아래)
RUN   apt-get install nginx  # → Layer 2 (큰 레이어)
COPY  nginx.conf /etc/       # → Layer 3
EXPOSE 80                    # → Layer 4 (0B, 메타데이터만)
CMD   ["nginx", "-g", ...]   # → Layer 5 (최신, 가장 위)
```

`0B` 크기의 레이어는 파일 시스템 변경 없이 메타데이터만 기록하는 것들이다. `EXPOSE`, `CMD`, `ENV`, `LABEL` 등의 명령이 여기에 해당한다.

![Dockerfile 명령과 레이어 매핑](/assets/posts/docker-image-history-layers.svg)

## 레이어 크기 분석으로 최적화 포인트 찾기

`history`로 가장 큰 레이어를 식별한 뒤 Dockerfile을 최적화할 수 있다.

```bash
# 크기 내림차순으로 정렬
docker image history myapp:latest \
  --format "{{.Size}}\t{{.CreatedBy}}" \
  | sort -rh | head -5
```

자주 발견되는 큰 레이어 원인:
- `apt-get install`에서 캐시를 지우지 않음 (`rm -rf /var/lib/apt/lists/*` 추가)
- `COPY` 명령으로 `.git`, `node_modules` 등을 통째로 복사 (`.dockerignore` 활용)
- 여러 `RUN` 명령을 분리해서 중간 파일이 레이어에 남음 (체이닝으로 합치기)

## inspect로 더 상세한 레이어 정보 확인

```bash
docker inspect nginx:latest \
  --format '{{range .RootFS.Layers}}{{println .}}{{end}}'
```

이렇게 하면 각 레이어의 정확한 SHA256 Digest를 확인할 수 있다.

---

**지난 글:** [docker rmi — 이미지 삭제](/posts/docker-image-rmi/)

**다음 글:** [docker image prune — 불필요한 이미지 정리](/posts/docker-image-prune/)

<br>
읽어주셔서 감사합니다. 😊
