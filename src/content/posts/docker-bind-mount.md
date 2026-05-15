---
title: "Bind Mount 완전 정복: 호스트 디렉터리를 컨테이너에 마운트"
description: "Docker Bind Mount로 호스트 파일시스템을 컨테이너에 연결하는 방법을 다룹니다. 개발 환경 핫리로드 패턴, 읽기 전용 마운트, SELinux 옵션, node_modules 충돌 해결까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "bind mount", "바인드 마운트", "개발 환경", "volume"]
featured: false
draft: false
---

[지난 글](/posts/docker-volume-anonymous/)에서 Anonymous Volume이 어떻게 생성되고 관리되는지 살펴봤다. 이번에는 **Bind Mount**를 다룬다. 호스트의 특정 경로를 컨테이너 내부에 직접 연결하는 방식으로, 개발 환경에서 소스 코드 핫리로드에 가장 많이 쓰인다.

## Bind Mount란

호스트 파일시스템의 임의 경로를 컨테이너의 특정 경로에 그대로 연결한다. Docker가 볼륨 데이터를 관리하는 Named Volume과 달리, Bind Mount는 사용자가 호스트 경로를 직접 지정한다.

![Bind Mount 구조](/assets/posts/docker-bind-mount-arch.svg)

```bash
# 기본 문법
docker run -v /호스트/절대경로:/컨테이너/경로 이미지명

# 현재 디렉터리 마운트
docker run -v $(pwd)/src:/app node:20

# --mount 방식 (더 명시적)
docker run --mount type=bind,source=$(pwd)/src,target=/app node:20
```

호스트 경로는 반드시 절대 경로여야 한다. `$(pwd)`를 활용하면 현재 디렉터리 기준 상대 경로를 절대 경로로 변환할 수 있다.

## Named Volume과의 차이

| 항목 | Bind Mount | Named Volume |
|------|-----------|--------------|
| 경로 지정 | 호스트 절대 경로 | 이름만 |
| 관리 주체 | 사용자 | Docker |
| 없을 때 | 에러 발생 | 자동 생성 |
| 이식성 | 호스트 경로 의존 | 이식성 높음 |
| 주용도 | 개발, 설정 주입 | 영속 데이터 |

## 개발 환경에서의 활용

Bind Mount의 핵심 사용 사례는 소스 코드를 컨테이너 안에서 실행하면서 호스트에서 편집하는 패턴이다.

![Bind Mount 개발 워크플로우](/assets/posts/docker-bind-mount-devflow.svg)

```bash
# Node.js 개발 서버 예시
docker run -it --rm \
  -v $(pwd)/src:/app \
  -p 3000:3000 \
  -w /app \
  node:20-alpine \
  node --watch server.js
```

호스트에서 파일을 저장하면 컨테이너 안 프로세스에 즉시 반영된다. 이미지를 다시 빌드할 필요가 없다.

## node_modules 충돌 문제

Node.js에서 흔히 발생하는 문제다. 호스트의 소스를 Bind Mount하면 컨테이너 이미지에 설치된 `node_modules`가 호스트의 `node_modules`로 덮어씌워진다.

```bash
# 이렇게 하면 node_modules도 호스트 것으로 덮어씌워짐
docker run -v $(pwd):/app node:20 node server.js
# 호스트에 node_modules 없거나 플랫폼이 다르면 에러
```

해결책은 `node_modules`를 Anonymous Volume으로 별도 마운트해 Bind Mount보다 우선시하는 것이다.

```bash
# node_modules를 별도 볼륨으로 보호
docker run \
  -v $(pwd):/app \
  -v /app/node_modules \
  node:20 node server.js
```

`-v /app/node_modules`는 Anonymous Volume을 `/app/node_modules`에 마운트한다. Bind Mount보다 나중에 선언했으므로 이 경로에서 Bind Mount를 덮어쓴다. 컨테이너 안의 `node_modules`가 보존된다.

## 읽기 전용 마운트

설정 파일이나 시크릿을 컨테이너에 주입할 때 쓰기를 막으려면 `:ro` 옵션을 붙인다.

```bash
# 설정 파일을 읽기 전용으로 주입
docker run \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx

# --mount 방식
docker run --mount type=bind,source=$(pwd)/nginx.conf,target=/etc/nginx/nginx.conf,readonly nginx
```

## SELinux 환경 (`:z`, `:Z`)

SELinux가 활성화된 RHEL/Fedora/CentOS 환경에서는 컨테이너가 호스트 파일에 접근할 때 SELinux 레이블 문제가 생길 수 있다.

```bash
# :z → 공유 레이블 (여러 컨테이너가 접근 가능)
docker run -v $(pwd)/data:/data:z my-app

# :Z → 전용 레이블 (이 컨테이너만 접근)
docker run -v $(pwd)/data:/data:Z my-app
```

SELinux가 없는 환경에서는 이 옵션이 무시된다.

## Windows·Mac에서의 주의사항

Docker Desktop(Windows, Mac)에서 Bind Mount를 사용하면 호스트 파일시스템과 Linux VM 사이에 파일 동기화 레이어가 생긴다. 이 때문에 I/O 성능이 Linux 직접 실행보다 느릴 수 있다.

```bash
# Docker Desktop에서 성능 힌트 (구버전 Docker에서 사용)
docker run -v $(pwd)/src:/app:cached node:20 # 읽기 위주
docker run -v $(pwd)/src:/app:delegated node:20 # 쓰기 위주
```

최신 Docker Desktop은 VirtioFS를 기본으로 사용해 이전보다 성능이 크게 개선됐다.

## 주의사항

- 호스트 경로가 존재하지 않으면 에러 (Named Volume과 달리 자동 생성 안 됨)
- 호스트 경로가 파일이면 파일 단위 마운트, 디렉터리면 디렉터리 단위 마운트
- 컨테이너 내부 경로에 이미 파일이 있으면 호스트 내용으로 완전히 가려짐
- 절대 경로 필수 (`./src` 등 상대 경로는 `-v`에서 에러)

## 핵심 정리

- Bind Mount는 호스트 절대 경로를 컨테이너 경로에 직접 연결
- 개발 환경 소스 핫리로드, 설정 파일 주입에 최적
- Node.js `node_modules` 충돌은 `-v /app/node_modules` Anonymous Volume으로 해결
- 읽기 전용 `:ro`, SELinux 환경 `:z`/`:Z` 옵션 활용
- 프로덕션 영속 데이터에는 Named Volume을 선호

---

**지난 글:** [Anonymous Volume 이해하기: 컨테이너와 함께 사는 볼륨](/posts/docker-volume-anonymous/)

**다음 글:** [tmpfs 마운트: 메모리 기반 임시 파일 시스템](/posts/docker-tmpfs/)

<br>
읽어주셔서 감사합니다. 😊
