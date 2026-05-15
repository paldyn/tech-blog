---
title: "docker rmi — 이미지 삭제"
description: "docker rmi와 docker image rm 명령으로 로컬 이미지를 삭제하는 방법, 태그 제거와 레이어 삭제의 차이, 강제 삭제(-f) 옵션, 일괄 삭제 패턴, 자주 발생하는 오류와 해결법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "rmi", "image", "rm", "삭제", "dangling"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-list/)에서 `docker images` 명령으로 로컬에 저장된 이미지 목록을 확인하는 방법을 살펴봤다. 이번에는 그 반대 동작인 이미지 삭제를 다룬다. `docker rmi` 하나처럼 보이지만, 태그를 지우는 것과 레이어를 실제로 삭제하는 것은 엄연히 다른 개념이다. 이 차이를 이해하면 불필요한 에러를 피하고 디스크를 안전하게 관리할 수 있다.

## 기본 문법

```bash
# 태그로 삭제
docker rmi nginx:latest

# docker image rm (권장 형식)
docker image rm nginx:latest

# IMAGE ID로 삭제 (앞 12자 이상)
docker rmi abc123def456

# 여러 이미지 한 번에 삭제
docker rmi nginx:1.25 redis:7 myapp:v1
```

`docker rmi`와 `docker image rm`은 완전히 동일한 명령이다. 긴 형식이 직관적이지만 스크립트에서는 짧은 `rmi`를 많이 사용한다.

## 태그 제거와 레이어 삭제의 차이

Docker 이미지를 삭제한다는 것은 두 단계가 있다.

1. **태그(Tag) 제거**: 이미지 이름을 지우는 것. 레이어는 그대로 남아 있을 수 있다.
2. **레이어 삭제**: 실제 파일 시스템 데이터를 디스크에서 제거한다.

같은 IMAGE ID를 가리키는 태그가 여럿 있을 때, `rmi`를 실행하면 해당 태그만 제거되고 다른 태그가 여전히 같은 이미지를 참조하므로 레이어는 삭제되지 않는다.

```bash
# 두 태그가 같은 이미지를 참조하는 경우
docker images nginx
# nginx  latest  e5e16e1a5897
# nginx  1.25    e5e16e1a5897  ← 같은 ID

docker rmi nginx:latest
# Untagged: nginx:latest  ← 태그만 제거
# (레이어는 nginx:1.25가 참조 중이므로 유지)

docker rmi nginx:1.25
# Untagged: nginx:1.25
# Deleted: sha256:e5e16...  ← 이제 레이어도 삭제
```

![태그 삭제 vs 레이어 삭제](/assets/posts/docker-image-rmi-flow.svg)

## -f (--force) 옵션

컨테이너가 해당 이미지를 사용하고 있으면 기본적으로 삭제가 거부된다.

```bash
docker rmi nginx:latest
# Error: image is being used by container 3f4a...
```

이때 `-f` 옵션을 사용하면 태그를 강제로 제거할 수 있다.

```bash
docker rmi -f nginx:latest
```

단, 컨테이너가 **실행 중**인 경우에는 레이어를 즉시 삭제할 수 없으므로 태그만 제거되고 레이어는 컨테이너가 종료될 때까지 유지된다. 실행 중인 컨테이너를 강제로 죽이는 것이 아님을 기억하자.

정지된 컨테이너가 이미지를 참조하는 경우에는 먼저 컨테이너를 삭제하거나 `-f`로 강제 삭제하는 것이 더 안전하다.

```bash
# 정지된 컨테이너 먼저 삭제 후 이미지 삭제
docker rm my-container
docker rmi nginx:latest
```

## --no-prune 옵션

기본적으로 `rmi`는 태깅이 해제되어 참조가 없어진 부모(중간) 레이어도 함께 정리한다. `--no-prune`을 사용하면 부모 이미지를 유지할 수 있다.

```bash
docker rmi --no-prune myapp:v1
```

빌드 캐시를 의도적으로 보존하고 싶을 때 유용하지만 일반적인 상황에서는 기본값을 그대로 쓰는 것이 좋다.

## 일괄 삭제 패턴

```bash
# 댕글링(dangling) 이미지 전부 삭제
docker rmi $(docker images -qf dangling=true)

# 특정 이름의 이미지 전부 삭제
docker rmi $(docker images -q myapp)

# 모든 이미지 삭제 (주의!)
docker rmi $(docker images -q)
```

`$()` 서브셸 방식은 목록이 비어 있을 때 오류가 발생할 수 있다. 더 안전한 방법은 `docker image prune`을 활용하거나 `-q` 결과를 파이프로 처리하는 것이다.

![docker rmi 명령 패턴](/assets/posts/docker-image-rmi-commands.svg)

## 자주 발생하는 오류와 해결법

| 오류 메시지 | 원인 | 해결 방법 |
|-------------|------|-----------|
| `image is being used by running container` | 실행 중 컨테이너가 해당 이미지 참조 | 컨테이너 종료 후 삭제 |
| `image is being used by stopped container` | 정지된 컨테이너가 이미지 참조 | `docker rm` 후 삭제 또는 `-f` |
| `No such image` | 이미지 이름/ID 오타 | `docker images`로 정확한 이름 확인 |
| `conflict: unable to delete` | 다른 이미지가 레이어 공유 | 의존하는 이미지 먼저 삭제 |

## 이미지 삭제 후 확인

```bash
# 삭제 후 목록 재확인
docker images

# 실제 디스크 변화 확인
docker system df
```

`docker system df`로 삭제 전후의 실제 디스크 절감량을 확인할 수 있다. 레이어가 공유되고 있는 경우 눈에 띄는 변화가 없을 수도 있으니 참고하자.

---

**지난 글:** [docker image ls — 이미지 목록 조회](/posts/docker-image-list/)

**다음 글:** [docker image history — 이미지 레이어 이력 조회](/posts/docker-image-history/)

<br>
읽어주셔서 감사합니다. 😊
