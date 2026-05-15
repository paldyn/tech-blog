---
title: "docker export/import — 컨테이너 스냅샷 활용"
description: "docker export로 컨테이너 파일 시스템을 tar 파일로 추출하고 docker import로 새 이미지를 만드는 방법, save/load와의 결정적 차이, --change 옵션으로 메타데이터 복원하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "export", "import", "컨테이너", "스냅샷", "파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-save-load/)에서 이미지를 tar 파일로 저장하고 복원하는 `save/load`를 알아봤다. 이번에는 이름이 비슷하지만 완전히 다른 개념인 `docker export`와 `docker import`를 살펴본다. 핵심 차이를 한 마디로 정리하면, `save`는 **이미지**를, `export`는 **컨테이너의 파일 시스템**을 tar로 만드는 것이다.

## export — 컨테이너 파일 시스템 추출

```bash
# 실행 중인 컨테이너 파일 시스템 추출
docker export mycontainer -o snapshot.tar

# 정지된 컨테이너도 export 가능
docker stop mycontainer
docker export mycontainer -o snapshot.tar

# stdout 리다이렉트
docker export mycontainer > snapshot.tar
```

`export`는 컨테이너 ID나 이름으로 실행한다. 이미지 이름이 아니다. 실행 중이든 정지 상태든 상관없이 현재 파일 시스템 상태(쓰기 레이어 포함)를 tar로 추출한다.

## import — tar를 새 이미지로 변환

```bash
# tar 파일을 새 이미지로 생성
docker import snapshot.tar myimage:v1

# stdin 파이프
cat snapshot.tar | docker import - myimage:v1

# URL에서 직접 import
docker import http://example.com/image.tar myimage:v1
```

`import`로 만들어진 이미지는 **단일 레이어**다. 원래 이미지의 레이어 구조는 사라지고 파일 시스템 전체가 하나의 레이어로 평탄화된다.

![export/import와 save/load 비교](/assets/posts/docker-image-import-export-comparison.svg)

## --change로 메타데이터 복원

export는 파일 시스템만 추출하므로 `CMD`, `ENV`, `EXPOSE` 같은 이미지 메타데이터는 잃어버린다. `import`할 때 `--change` 옵션으로 이를 다시 지정해야 컨테이너가 정상적으로 실행된다.

```bash
docker import snapshot.tar \
  --change 'CMD ["/usr/local/bin/myapp"]' \
  --change 'ENV APP_ENV=production' \
  --change 'EXPOSE 8080' \
  myimage:v1
```

`--change`에 올 수 있는 Dockerfile 명령: `CMD`, `ENTRYPOINT`, `ENV`, `EXPOSE`, `LABEL`, `ONBUILD`, `USER`, `VOLUME`, `WORKDIR`

![export/import 명령 패턴](/assets/posts/docker-image-import-export-commands.svg)

## save/load와 export/import의 결정적 차이

| 기준 | save/load | export/import |
|------|-----------|---------------|
| 대상 | 이미지 (Image) | 컨테이너 (Container) |
| 레이어 구조 | 모두 보존 | 단일 레이어로 평탄화 |
| 히스토리 | 보존 | 소실 |
| 메타데이터 | 보존 | 소실 (--change로 재정의) |
| 태그 | 자동 복원 | 수동 지정 필요 |
| 이미지 크기 | 원본과 동일 | 보통 더 크거나 비슷 (공유 레이어 없음) |

일반적인 이미지 전송에는 반드시 `save/load`를 사용한다. `export/import`는 매우 특수한 경우에만 쓴다.

## export/import가 유용한 경우

**컨테이너 상태 스냅샷**: 컨테이너 실행 도중 설정 파일이나 데이터가 변경된 상태를 새 이미지로 만들고 싶을 때.

```bash
# 컨테이너에서 작업 후 스냅샷
docker exec myapp bash -c "some modifications"
docker export myapp | docker import - myapp:modified
```

**이미지 레이어 제거로 크기 최적화**: 여러 레이어에 걸쳐 삭제된 파일이 여전히 레이어에 남아 있는 경우, export/import로 평탄화하면 실제 필요한 파일만 남길 수 있다. 단, 히스토리와 레이어 캐시를 잃는 트레이드오프가 있다.

**외부 시스템 파일 시스템 가져오기**: 다른 가상화 도구나 파일 시스템 아카이브를 Docker 이미지로 변환할 때.

```bash
# 외부 rootfs tar를 이미지로
docker import rootfs.tar.gz \
  --change 'CMD ["/bin/bash"]' \
  mycustom:base
```

## 주의사항

export로 만든 이미지는 레이어가 없으므로 빌드 캐시 활용이 불가능하다. 이 이미지를 베이스로 다시 빌드하면 매번 전체 레이어부터 다시 빌드해야 한다. 프로덕션 이미지 관리에는 적합하지 않다.

---

**지난 글:** [docker image save/load — 이미지 파일 저장·불러오기](/posts/docker-image-save-load/)

**다음 글:** [Docker 이미지 레이어 구조 이해하기](/posts/docker-image-layers/)

<br>
읽어주셔서 감사합니다. 😊
