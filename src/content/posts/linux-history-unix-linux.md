---
title: "Unix와 Linux의 역사: C언어, GNU, 그리고 Linus Torvalds"
description: "1969년 Bell Labs에서 시작된 Unix, Stallman의 GNU 운동, Torvalds의 Linux 커널까지 — 현대 OS 역사를 한 흐름으로 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["Linux", "Unix", "GNU", "역사", "오픈소스"]
featured: false
draft: false
---

[지난 글](/posts/linux-what-is-linux/)에서 Linux가 커널임을 확인했다. 그렇다면 그 커널은 어디서 왔을까. Linux를 이해하려면 1969년 미국 뉴저지 Bell Labs로 거슬러 올라가야 한다. 수십 년에 걸친 운영체제 역사가 오늘날 우리가 쓰는 명령어 하나하나에 녹아 있다.

## 모든 것의 시작: Unix (1969)

1969년 Bell Labs의 켄 톰프슨(Ken Thompson)과 데니스 리치(Dennis Ritchie)는 PDP-7 컴퓨터에서 소규모 운영체제를 만들었다. 처음엔 어셈블리로 작성됐지만, 1973년 리치가 C언어를 개발하면서 Unix 전체를 C로 재작성했다. 이는 혁명적인 결정이었다. **특정 CPU 아키텍처에 종속되지 않는 이식성 높은 OS**가 처음 탄생한 것이다.

Unix는 AT&T 내부와 대학에 소스코드와 함께 배포됐다. UC 버클리는 이를 개량해 **BSD(Berkeley Software Distribution)**를 만들었고, 수많은 변종 Unix가 생겨났다. 하지만 AT&T가 상업화에 나서자 Unix 소스코드는 비공개가 됐고, 누구나 자유롭게 쓸 수 있는 OS가 사라졌다.

![Unix → Linux 역사 타임라인](/assets/posts/linux-history-unix-linux-timeline.svg)

## GNU 프로젝트와 자유 소프트웨어 운동 (1983)

1983년, MIT 해커 리처드 스톨먼(Richard Stallman)은 "GNU is Not Unix"라는 이름의 프로젝트를 시작한다. 목표는 명확했다 — **Unix와 완전히 호환되지만 완전히 자유로운 OS를 만드는 것**. 이 과정에서 `gcc` 컴파일러, `glibc` 표준 라이브러리, `bash` 셸, `make` 빌드 도구 등 핵심 시스템 소프트웨어가 탄생했다.

스톨먼은 GPL(GNU General Public License)이라는 독창적인 라이선스를 설계했다. GPL의 핵심 아이디어는 **"카피레프트(Copyleft)"** — 자유 소프트웨어를 가져다 쓰면 그 결과물도 자유 소프트웨어여야 한다. 덕분에 기업이 GNU 코드를 가져다 독점 소프트웨어에 집어넣을 수 없게 됐다.

하지만 1990년대 초, GNU 프로젝트에는 한 가지가 빠져 있었다. **커널**. GNU Hurd라는 커널 개발이 진행 중이었지만 완성되지 않았다.

## Linux 커널의 탄생 (1991)

1991년 8월 25일, 핀란드 헬싱키 대학원생 리누스 토르발스(Linus Torvalds)는 `comp.os.minix` 뉴스그룹에 역사적인 메시지를 올린다.

```
"Hello everybody out there using minix -
I'm doing a (free) operating system (just a hobby, won't be big and
professional like gnu) for 386(486) AT clones."
              — Linus Torvalds, 1991-08-25
```

"취미 프로젝트"라고 겸손하게 소개한 이 커널이 Linux 0.01이다. Torvalds는 GPL v2 라이선스를 선택했고, 이 커널이 GNU 도구들과 결합하면서 **GNU/Linux** — 완전한 자유 운영체제가 완성됐다.

```bash
# Linux 커널 버전 확인
uname -r
# 6.8.0-41-generic

# 커널 빌드 정보
uname -a
# Linux hostname 6.8.0-41-generic #41-Ubuntu SMP
# PREEMPT_DYNAMIC Fri Aug  2 17:02:29 UTC 2024
# x86_64 x86_64 x86_64 GNU/Linux
```

## 배포판의 등장과 대중화

커널만으로는 일반 사용자가 쓸 수 없다. 1993년 Debian, 1994년 Red Hat과 Slackware 같은 **배포판(distribution)**이 등장하면서 Linux는 실용적인 OS로 자리잡기 시작했다. 배포판은 커널 + GNU 도구 + 패키지 관리자 + 설정 파일을 묶어 설치하기 쉽게 만든 것이다.

2004년 Ubuntu가 등장하면서 Linux는 데스크톱에서도 널리 쓰이기 시작했다. 2008년 Google이 Android에 Linux 커널을 채택하면서 스마트폰 세계도 정복했다. 현재 Linux 커널 개발에는 전 세계 21,000명 이상의 개발자와 1,700곳 이상의 기업이 기여하고 있다.

## 오픈소스 라이선스의 세계

![오픈소스 라이선스와 GNU/Linux](/assets/posts/linux-history-unix-linux-licenses.svg)

Unix 계열 OS는 크게 GPL 계열(Linux)과 BSD 계열(FreeBSD, macOS Darwin)로 나뉜다. macOS는 BSD 기반의 Darwin 커널을 사용하기 때문에 Unix 인증을 받은 POSIX 호환 OS다. 반면 Linux는 Unix 코드를 사용하지 않고 처음부터 새로 작성한 **Unix-like** OS다.

이 차이는 라이선스 충돌을 피하기 위한 의도적인 선택이었다. Torvalds와 GNU 개발자들은 AT&T의 Unix 소스코드를 사용하지 않고, Unix의 **동작 방식과 API**만 참고해 완전히 새로 구현했다. 덕분에 Linux는 법적 분쟁 없이 자유롭게 배포될 수 있었다.

## 역사가 왜 중요한가

Linux 명령어의 이름과 동작 방식은 Unix에서 왔다. `ls`, `grep`, `awk`, `sed` — 이 도구들은 1970~80년대에 설계됐고, 40년 넘게 호환성이 유지되고 있다. 역사를 알면 **왜 이 명령어가 이렇게 동작하는지**, **왜 이런 철학이 생겼는지** 이해하는 데 도움이 된다. 다음 글에서는 이 역사에서 파생된 수많은 Linux 배포판들을 살펴본다.

---

**지난 글:** [Linux란 무엇인가: 커널부터 배포판까지 한눈에](/posts/linux-what-is-linux/)

**다음 글:** [Linux 배포판 한눈에 보기: Ubuntu·RHEL·Arch의 차이](/posts/linux-distributions-overview/)

<br>
읽어주셔서 감사합니다. 😊
