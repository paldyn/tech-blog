---
title: "docker rename — 컨테이너 이름 변경"
description: "docker rename 명령으로 실행 중인 컨테이너의 이름을 재시작 없이 즉시 변경하는 방법, 블루-그린 전환 패턴, 네이밍 컨벤션, 그리고 주의 사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "rename", "container", "naming"]
featured: false
draft: false
---

[지난 글](/posts/docker-pause-unpause/)에서 컨테이너를 종료 없이 일시 정지하는 방법을 다뤘다. 이번에는 훨씬 단순하지만 알아두면 유용한 `docker rename`을 살펴본다. 컨테이너를 재시작하거나 재생성하지 않고 이름만 교체할 수 있어, 운영 중 이름 정리나 배포 패턴 구현에 활용된다.

## 기본 사용법

```bash
docker rename <OLD_NAME> <NEW_NAME>
```

실행 중인 컨테이너에도 즉시 적용된다. 재시작이 없으므로 서비스 중단 없이 이름을 바꿀 수 있다.

```bash
# 자동 생성된 이름을 의미 있는 이름으로 변경
docker rename quirky_hypatia web

# 확인
docker ps --filter name=web
```

![rename 동작 원리](/assets/posts/docker-rename-flow.svg)

이름이 바뀌어도 컨테이너 ID, 이미지, 볼륨, 네트워크 연결, 환경 변수, 포트 매핑은 모두 그대로다. 오직 이름만 바뀐다.

## 네이밍 컨벤션 정리

프로젝트가 커지면 컨테이너 이름 규칙이 뒤섞이는 경우가 생긴다. `docker rename`으로 정리할 수 있다.

```bash
# 환경 접두사 추가
docker rename app prod-app

# 버전 정보 포함
docker rename db db-postgres16

# 역할 명시
docker rename 3a2f1b nginx-frontend
```

유효한 이름은 영문자, 숫자, 하이픈(`-`), 언더스코어(`_`)로만 구성해야 한다. 슬래시는 허용되지 않는다.

## 블루-그린 전환 패턴

`docker rename`의 가장 실용적인 용도 중 하나는 무중단 배포에서 서비스 이름을 전환하는 것이다.

```bash
# 1. 신버전 컨테이너 준비 (별도 이름으로 실행)
docker run -d --name web-new myapp:v2

# 2. 신버전 준비 완료 확인
docker exec web-new curl -sf http://localhost/health

# 3. 구버전 이름 보관 (롤백 대비)
docker rename web web-old

# 4. 신버전을 서비스 이름으로 승격
docker rename web-new web

# 5. 문제없으면 구버전 정리
docker rm web-old
```

이 패턴은 로드 밸런서가 컨테이너 이름 기반으로 서비스를 탐색하는 환경에서 특히 효과적이다. 이름 전환이 즉시 일어나므로 새 이름으로 들어오는 요청이 신버전으로 라우팅된다.

![docker rename 명령 패턴](/assets/posts/docker-rename-commands.svg)

## 주의 사항

**이름 충돌:** 이미 같은 이름의 컨테이너가 존재하면 오류가 발생한다.

```bash
docker rename web web-old
# Error: Conflict. The container name "/web-old" is already in use
```

먼저 기존 컨테이너를 제거하거나 다른 이름으로 바꿔야 한다.

**Docker Compose와의 충돌:** Compose가 관리하는 컨테이너의 이름을 변경하면 Compose가 해당 컨테이너를 인식하지 못한다. `docker compose up`, `docker compose ps` 등이 오동작할 수 있으니 Compose 환경에서는 rename 대신 Compose 설정을 통해 이름을 관리하는 것이 안전하다.

**같은 네트워크 내 DNS:** Docker의 내부 DNS는 컨테이너 이름을 도메인으로 사용하므로, rename 후에는 같은 사용자 정의 네트워크 내 다른 컨테이너들이 새 이름으로 해당 컨테이너에 접근해야 한다. 기존 이름을 참조하는 설정이 있다면 함께 업데이트해야 한다.

---

**지난 글:** [docker pause / unpause — 컨테이너 일시 정지](/posts/docker-pause-unpause/)

**다음 글:** [Docker 이미지의 본질 — 레이어와 유니온 마운트](/posts/docker-image-essence/)

<br>
읽어주셔서 감사합니다. 😊
