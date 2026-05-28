---
title: "로케일 및 인코딩 문제 — 한글 깨짐 트러블슈팅"
description: "한글 모지바케, 물음표 출력, 인코딩 오류를 locale, file, hexdump, iconv로 진단하고 LANG/LC_ALL 설정과 locale-gen으로 복구하는 방법을 설명합니다. SSH 로케일 전파 문제도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "locale", "encoding", "UTF-8", "EUC-KR", "iconv", "troubleshooting"]
featured: false
draft: false
---

[지난 글](/posts/linux-time-sync-issues/)에서 시간 동기화 문제를 다뤘다. 이번에는 한글이 `???`이나 이상한 기호로 나오는 인코딩·로케일 문제를 살펴본다. 서버에 SSH로 접속했을 때 갑자기 한글이 깨지거나, 스크립트가 다국어 파일을 처리하지 못하는 상황이 여기에 해당한다.

## 로케일과 인코딩의 관계

**로케일(Locale)**은 언어, 지역, 문자 인코딩 등 국제화 설정의 묶음이다. `LANG=ko_KR.UTF-8`은 "한국어, 한국 지역, UTF-8 인코딩"을 의미한다.

**인코딩(Encoding)**은 문자를 바이트로 표현하는 방식이다. 같은 한글이라도 UTF-8로 저장된 파일을 EUC-KR로 읽으면 글자가 깨진다.

핵심 환경 변수:
- `LANG` — 기본 로케일 (다른 LC_* 변수의 기본값)
- `LC_CTYPE` — 문자 분류 및 변환
- `LC_ALL` — 모든 LC_* 변수를 한 번에 덮어씀

![로케일 / 인코딩 문제 트러블슈팅](/assets/posts/linux-locale-encoding-issues-flow.svg)

## 1단계 — 현재 로케일 확인

```bash
locale
```

출력 예 (문제 있는 상태):

```
LANG=
LC_CTYPE="POSIX"
LC_ALL=
```

`POSIX` 또는 `C`가 보이면 ASCII만 지원하는 최소 로케일이다. 한글 처리가 불가능하다.

올바른 출력:

```
LANG=ko_KR.UTF-8
LC_CTYPE="ko_KR.UTF-8"
```

## 2단계 — 로케일 설치 여부 확인 및 생성

```bash
locale -a | grep -i ko
# 설치된 경우: ko_KR.utf8  또는  ko_KR.UTF-8
```

없으면 로케일을 생성한다.

```bash
# Debian/Ubuntu
sudo locale-gen ko_KR.UTF-8
sudo update-locale LANG=ko_KR.UTF-8

# RHEL/Rocky
sudo dnf install glibc-langpack-ko
# 또는 /etc/locale.gen 편집 후
sudo localedef -i ko_KR -f UTF-8 ko_KR.UTF-8
```

```bash
# 즉시 적용 (현재 세션)
export LANG=ko_KR.UTF-8
export LC_ALL=ko_KR.UTF-8
```

시스템 전체 적용은 `/etc/locale.conf` (systemd 기반) 또는 `/etc/default/locale` 수정 후 재로그인이 필요하다.

## 3단계 — 파일 인코딩 확인

```bash
file -i document.txt
# document.txt: text/plain; charset=euc-kr
```

![로케일 / 인코딩 진단 명령어](/assets/posts/linux-locale-encoding-issues-commands.svg)

UTF-8 예상 파일이 EUC-KR로 저장된 경우 `iconv`로 변환한다.

```bash
# EUC-KR → UTF-8 변환
iconv -f EUC-KR -t UTF-8 euc_file.txt -o utf8_file.txt

# 변환 결과 검증
file -i utf8_file.txt
# utf8_file.txt: text/plain; charset=utf-8
```

## 4단계 — 헥스 덤프로 바이트 직접 확인

파일 인코딩 감지가 틀릴 수 있다. 실제 바이트를 확인한다.

```bash
hexdump -C file.txt | head -3
# 한글 '가'의 UTF-8: EF B1 80 (또는 EA B0 80)
# 한글 '가'의 EUC-KR: B0 A1

xxd file.txt | head -5
```

UTF-8 BOM(Byte Order Mark)이 있는 파일:

```bash
# BOM 확인 (EF BB BF로 시작)
hexdump -C file.txt | head -1 | grep "ef bb bf"

# BOM 제거
sed -i '1s/^\xef\xbb\xbf//' file.txt
```

## SSH 접속 시 로케일 전파 문제

원격 서버에서 한글이 깨질 때 SSH가 클라이언트 로케일을 전달하는 방식이 원인일 수 있다.

```bash
# 클라이언트: ~/.ssh/config
Host myserver
    SendEnv LANG LC_*

# 서버: /etc/ssh/sshd_config
AcceptEnv LANG LC_*
```

서버에 해당 로케일이 없으면 오류가 발생한다. 서버에 없는 로케일을 보내지 않도록 클라이언트에서 `SendEnv LANG`을 제거하거나, 서버에 로케일을 설치한다.

## Python/스크립트에서 인코딩 오류

```bash
# Python 3 기본 인코딩 확인
python3 -c "import sys; print(sys.getdefaultencoding())"
python3 -c "import sys; print(sys.stdout.encoding)"

# 스크립트 실행 시 인코딩 강제
PYTHONIOENCODING=utf-8 python3 script.py
```

## 자주 발생하는 상황 요약

| 증상 | 원인 | 해결 |
|------|------|------|
| SSH 접속 후 한글 깨짐 | 로케일 미설치 | locale-gen + 재로그인 |
| `???` 출력 | LANG=C 또는 POSIX | LANG=ko_KR.UTF-8 설정 |
| 파일 내용 깨짐 | EUC-KR 파일을 UTF-8로 읽음 | iconv 변환 |
| Python UnicodeDecodeError | 기본 인코딩 불일치 | PYTHONIOENCODING 설정 |
| BOM 문자 출력 | UTF-8 BOM 파일 | sed BOM 제거 |

로케일 문제의 핵심은 파일·터미널·프로그램 세 곳의 인코딩이 모두 일치해야 한다는 점이다. `locale → file -i → hexdump` 순서로 각 계층을 확인하면 대부분 원인을 찾을 수 있다.

---

**지난 글:** [시간 동기화 문제 — NTP/chrony 트러블슈팅](/posts/linux-time-sync-issues/)

**다음 글:** [종료 실패 — shutdown/reboot 멈춤 트러블슈팅](/posts/linux-shutdown-reboot-fail/)

<br>
읽어주셔서 감사합니다. 😊
