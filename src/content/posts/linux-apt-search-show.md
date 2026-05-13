---
title: "apt search · show — 패키지 탐색과 정보 조회"
description: "apt search, apt show, apt-cache policy, apt-file로 패키지를 탐색하고 의존성·버전·우선순위 정보를 조회하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "apt", "apt-cache", "apt-search", "apt-show", "apt-file", "package", "debian", "ubuntu"]
featured: false
draft: false
---

[지난 글](/posts/linux-apt-basics/)에서 apt로 패키지를 설치·제거·업그레이드하는 기본 흐름을 익혔습니다. 이번엔 설치 전에 패키지를 **찾고** 정보를 **읽는** 방법을 집중적으로 다룹니다. `apt search`, `apt show`, `apt-cache policy`를 자유롭게 쓸 수 있으면 미지의 패키지도 자신 있게 다룰 수 있습니다.

## apt search — 패키지 찾기

`apt search`는 로컬 캐시(`/var/lib/apt/lists/`)에서 **패키지 이름과 설명**을 정규표현식으로 검색합니다. 검색 전에 반드시 `apt update`로 캐시를 최신 상태로 유지해야 합니다.

```bash
# 키워드로 검색
apt search nginx

# 정규표현식: 이름이 python3-로 시작하는 패키지
apt search "^python3-"

# 이름만 검색 (설명 제외, 빠름)
apt search --names-only http

# 결과가 많으면 grep으로 필터
apt search web server | grep -i proxy
```

출력 형식: `패키지명/배포판 버전 아키텍처 [설치됨/자동]`

```
nginx/bookworm 1.26.0-1 amd64
  small, powerful, scalable web/proxy server
```

## apt show — 상세 정보

```bash
apt show nginx
```

주요 필드 설명:

| 필드 | 의미 |
|------|------|
| `Package` | 패키지명 |
| `Version` | 버전 |
| `Depends` | 반드시 필요한 의존성 |
| `Recommends` | 권장(기본 설치) |
| `Suggests` | 선택적 보완 패키지 |
| `Installed-Size` | 설치 후 디스크 사용량 |
| `Download-Size` | `.deb` 파일 크기 |
| `Homepage` | 프로젝트 공식 사이트 |

![apt search · show 탐색 흐름](/assets/posts/linux-apt-search-show-flow.svg)

## apt-cache — 스크립트 친화 조회

`apt-cache`는 출력이 안정적이어서 스크립트에서 사용하기 좋습니다.

```bash
# 검색 (apt search와 동일)
apt-cache search nginx

# 상세 정보 (apt show와 동일)
apt-cache show nginx

# 의존성 트리
apt-cache depends nginx

# 역의존성 — nginx에 의존하는 패키지
apt-cache rdepends nginx --no-recommends --no-suggests

# 패키지 통계
apt-cache stats
```

## apt-cache policy — 버전 및 우선순위

설치된 버전과 업그레이드 가능 버전, 저장소 우선순위를 한 번에 보여줍니다.

```bash
apt-cache policy nginx
```

![apt-cache policy 출력 읽기](/assets/posts/linux-apt-search-show-policy.svg)

우선순위 규칙:
- **1000+**: 설치·다운그레이드도 강제 (거의 안 씀)
- **500**: 기본 저장소
- **100**: 이미 설치된 패키지
- **-1**: 차단(pin으로 설정)

## apt-file — 파일로 패키지 찾기

어떤 명령이나 파일이 어느 패키지에 들어 있는지 찾을 때 유용합니다.

```bash
# apt-file 설치
apt install apt-file
apt-file update

# 파일명으로 패키지 검색
apt-file search /usr/bin/curl

# 패키지가 제공하는 파일 목록 (미설치도 가능)
apt-file list nginx
```

설치된 패키지는 `dpkg -L 패키지명`이 더 빠릅니다.

## 실전: 모르는 명령어 패키지 찾기

```bash
# "command not found" 시 패키지 찾기
# Ubuntu는 command-not-found 패키지가 자동으로 제안
# 수동으로:
apt-file search $(which htop 2>/dev/null || echo htop)

# 또는
dpkg -S $(which curl)    # 설치된 경우
apt-cache search htop    # 미설치
```

## 정리

`apt search` + `apt show` + `apt-cache policy` 세 가지를 조합하면 패키지를 설치하기 전에 필요한 정보를 모두 파악할 수 있습니다. `apt-file`은 파일이나 명령어가 어느 패키지에 속하는지 역방향으로 조회할 때 필수 도구입니다. 다음 글에서는 apt 아래의 저수준 도구인 `dpkg`를 살펴봅니다.

---

**지난 글:** [apt 기초](/posts/linux-apt-basics/)

**다음 글:** [dpkg 완전 이해 — .deb 패키지 저수준 관리](/posts/linux-dpkg/)

<br>
읽어주셔서 감사합니다. 😊
