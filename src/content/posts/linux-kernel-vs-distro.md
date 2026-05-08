---
title: "Linux 커널과 배포판의 차이: 무엇이 커널이고 무엇이 배포판인가"
description: "커널은 하나, 배포판은 수백 개 — 커널이 제공하는 것과 배포판이 추가하는 것을 명확히 구분한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["Linux", "커널", "배포판", "systemd", "패키지관리자"]
featured: false
draft: false
---

[지난 글](/posts/linux-distributions-overview/)에서 Ubuntu, RHEL, Arch 같은 배포판의 계열을 살펴봤다. 이 글에서는 한 발 더 들어가서, 배포판들이 공유하는 **커널**과 각 배포판이 고유하게 추가하는 **나머지 부분**을 명확히 구분한다. 이 구분을 이해하면 배포판이 달라도 공통 지식을 활용할 수 있게 된다.

## 커널: 모든 배포판의 공통 심장

kernel.org에서는 리누스 토르발스를 비롯한 커뮤니티가 관리하는 **업스트림(upstream) Linux 커널**을 배포한다. 이 커널은 특정 배포판과 무관하다. Ubuntu를 쓰든, RHEL을 쓰든, Arch를 쓰든 — 궁극적으로는 모두 이 커널을 기반으로 한다.

단, 배포판마다 커널 버전과 패치 방식이 다르다. Ubuntu는 최신 업스트림 커널을 비교적 빠르게 채택한다. RHEL은 특정 커널 버전을 가져다 수년간 **백포트(backport)** 보안 패치를 적용하며 유지한다. 그래서 RHEL 9.4의 커널이 `5.14.0`처럼 보여도, 실제로는 수천 개의 패치가 적용된 상태다.

![커널 버전과 배포판 버전은 별개](/assets/posts/linux-kernel-vs-distro-versions.svg)

## 배포판이 커널 위에 쌓는 것들

커널만으로는 로그인 프롬프트조차 볼 수 없다. 배포판은 커널 위에 다음 요소들을 추가한다.

![커널 vs 배포판 레이어 구조](/assets/posts/linux-kernel-vs-distro-layers.svg)

**패키지 관리자**: 소프트웨어를 설치·업데이트·제거하는 도구. Debian 계열은 `apt`와 `.deb`, RHEL 계열은 `dnf`와 `.rpm`, Arch는 `pacman`과 `.pkg.tar.zst`를 쓴다. 같은 `nginx`를 설치하더라도 패키지 관리자가 다르면 명령어가 다르다.

**init 시스템**: 커널 부팅 후 제일 먼저 실행되는 PID 1 프로세스. 대부분의 현대 배포판은 **systemd**를 사용하지만, Alpine Linux는 OpenRC를, void Linux는 runit을 사용한다. init 시스템이 다르면 서비스 관리 명령이 완전히 달라진다.

**GNU 코어 유틸리티(coreutils)**: `ls`, `cp`, `mv`, `cat` 같은 기본 명령어를 제공한다. Alpine Linux는 용량 절약을 위해 GNU coreutils 대신 BusyBox를 사용한다.

**기본 설정과 보안 정책**: 방화벽 기본값, SELinux/AppArmor 설정, 패키지 저장소 URL 등이 배포판마다 다르다.

## 직접 확인해보기

```bash
# 현재 커널 버전
uname -r

# 배포판 정보 확인 (표준화된 파일)
cat /etc/os-release

# 출력 예시 (Ubuntu)
# NAME="Ubuntu"
# VERSION="24.04.1 LTS (Noble Numbat)"
# ID=ubuntu
# ID_LIKE=debian
# PRETTY_NAME="Ubuntu 24.04.1 LTS"

# 설치된 init 시스템 확인
ps -p 1 -o comm=
# 출력: systemd (또는 init, runit 등)

# 시스템에 로드된 커널 모듈 확인
lsmod | head -10
```

## 커널 공간 vs 사용자 공간

커널이 관리하는 영역을 **커널 공간(kernel space)**, 사용자 프로그램이 실행되는 영역을 **사용자 공간(user space)**이라 한다.

| 영역 | 실행 레벨 | 포함 요소 |
|---|---|---|
| 커널 공간 | Ring 0 | 스케줄러, 메모리 관리, 드라이버 |
| 사용자 공간 | Ring 3 | bash, nginx, 앱 프로세스 |

사용자 공간의 프로세스가 커널 기능을 사용하려면 **시스템 콜(syscall)**을 통해 요청해야 한다. 이 경계가 있기 때문에 사용자 공간의 프로그램이 버그로 충돌해도 커널은 계속 실행된다.

## 배포판 독립적인 지식 vs 배포판 특화 지식

이 구분을 이해하면 학습 전략을 세울 수 있다.

**배포판 독립적**: 파일 시스템 개념, 프로세스 관리, 권한 시스템, 네트워킹 개념, 셸 스크립팅 — 어느 배포판에서나 동일하게 동작한다.

**배포판 특화**: 패키지 설치 명령, 서비스 활성화 방법, 기본 설정 파일 위치 — 배포판마다 다르지만 개념을 이해하면 금방 적응할 수 있다.

이 시리즈에서 다루는 내용 대부분은 배포판 독립적인 지식이다. 배포판 특화 명령어는 필요한 경우 Ubuntu/Debian과 RHEL 계열을 나란히 표시한다.

---

**지난 글:** [Linux 배포판 한눈에 보기: Ubuntu·RHEL·Arch의 차이](/posts/linux-distributions-overview/)

**다음 글:** [Linux 철학: 모든 것은 파일이다](/posts/linux-philosophy-everything-is-file/)

<br>
읽어주셔서 감사합니다. 😊
