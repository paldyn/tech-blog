---
title: "docker image save/load — 이미지 파일 저장·불러오기"
description: "docker image save로 이미지를 tar 파일로 저장하고 docker image load로 복원하는 방법, gzip 압축 활용, 여러 이미지 묶기, 에어갭 환경에서의 이미지 전달 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "save", "load", "tar", "에어갭", "offline", "이미지전송"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-prune/)에서 불필요한 이미지를 정리하는 방법을 살펴봤다. 이번에는 반대로, 이미지를 파일 형태로 저장해서 다른 환경으로 옮기는 `docker image save`와 `docker image load`를 다룬다. 인터넷이 차단된 에어갭(air-gap) 환경이나 레지스트리 없이 이미지를 전달해야 하는 상황에서 필수적인 기술이다.

## save — 이미지를 tar 파일로 저장

```bash
# 단일 이미지 저장
docker image save -o myapp.tar myapp:v1.0

# 짧은 형식
docker save -o myapp.tar myapp:v1.0

# stdout으로 출력 (리다이렉트)
docker save myapp:v1.0 > myapp.tar
```

`-o` 옵션으로 출력 파일을 지정하거나, stdout 리다이렉트(`>`)를 사용할 수 있다. 두 방식 모두 동일한 결과를 만든다.

## 여러 이미지를 하나의 파일로

```bash
# 여러 이미지를 bundle.tar 하나에 저장
docker image save \
  myapp:v1.0 redis:7 nginx:1.25 \
  -o bundle.tar
```

번들 파일 하나에 여러 이미지의 모든 레이어와 메타데이터가 포함된다. `docker load`로 불러오면 모든 이미지가 한꺼번에 복원된다.

## gzip 압축으로 크기 줄이기

tar 파일 자체는 압축되지 않는다. gzip과 조합하면 이미지 크기를 40~60% 줄일 수 있다.

```bash
# 압축해서 저장
docker save myapp:v1.0 | gzip > myapp.tar.gz

# 더 빠른 압축 (pigz 설치 필요)
docker save myapp:v1.0 | pigz > myapp.tar.gz
```

![save/load 흐름](/assets/posts/docker-image-save-load-flow.svg)

## load — tar 파일에서 이미지 복원

```bash
# 파일에서 로드
docker image load -i myapp.tar

# 압축 파일 로드 (gzip 자동 감지)
docker image load -i myapp.tar.gz

# stdin 리다이렉트
docker load < myapp.tar
```

로드 성공 시 이미지 이름과 태그가 원래대로 복원된다.

```
Loaded image: myapp:v1.0
Loaded image: redis:7
```

![save/load 명령 패턴](/assets/posts/docker-image-save-load-commands.svg)

## save/load가 보존하는 것

`docker save`는 레지스트리에 push하는 것과 달리 로컬에서 완전한 이미지 정보를 저장한다.

| 보존 항목 | 여부 |
|-----------|------|
| 모든 레이어 | ✓ |
| 이미지 태그 | ✓ |
| 이미지 히스토리 | ✓ |
| 메타데이터 (ENV, CMD 등) | ✓ |
| 멀티 태그 이미지 | ✓ |
| 컨테이너 실행 기록 | ✗ |

## 에어갭 환경 전달 워크플로

인터넷이 차단된 보안 환경(금융, 방위, 공공 기관 등)에서 이미지를 전달하는 표준 방법이다.

```bash
# 1. 인터넷 가능한 머신에서 save
docker pull myapp:v1.0
docker save -o myapp.tar myapp:v1.0
gzip myapp.tar   # → myapp.tar.gz

# 2. USB, SCP, 물리 매체로 이동
scp myapp.tar.gz user@airgap-host:/tmp/

# 3. 에어갭 환경에서 load
docker load -i /tmp/myapp.tar.gz
docker run myapp:v1.0
```

## tar 파일 내부 구조

`tar tf myapp.tar`로 내부를 확인해보면 이미지의 구성 요소가 보인다.

```
manifest.json           ← 이미지 목록과 레이어 매핑
repositories            ← 태그 정보
<layer-sha256>/layer.tar  ← 각 레이어 파일
<layer-sha256>/json     ← 레이어 메타데이터
```

이 구조는 OCI(Open Container Initiative) 이미지 레이아웃 명세를 따른다.

## save vs export 비교 미리보기

다음 글에서 자세히 다루겠지만, `docker export`는 컨테이너의 파일 시스템만 tar로 추출하는 것으로 `save`와 완전히 다르다. 이미지를 이동할 때는 항상 `save/load`를 사용한다.

---

**지난 글:** [docker image prune — 불필요한 이미지 정리](/posts/docker-image-prune/)

**다음 글:** [docker export/import — 컨테이너 스냅샷 활용](/posts/docker-image-import-export/)

<br>
읽어주셔서 감사합니다. 😊
