---
title: "tee: 파이프라인을 분기하는 T자 이음새"
description: "tee 명령어로 파이프라인 데이터를 파일과 stdout에 동시에 쓰는 방법, sudo tee 패턴, 파이프라인 중간 디버그 기법을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["Linux", "tee", "파이프라인", "리다이렉션", "sudo", "로깅"]
featured: false
draft: false
---

[지난 글](/posts/linux-echo-printf/)에서 표준 출력을 다루는 `echo`와 `printf`를 살펴봤다. 이번에는 파이프라인을 **두 방향으로 분기**하는 `tee`를 다룬다. 파이프라인 중간에서 데이터를 파일에 저장하면서 동시에 다음 명령으로 전달해야 할 때 `tee`가 없으면 매우 복잡해진다.

## tee가 없으면 생기는 문제

파이프라인 출력을 파일에 저장하면서 동시에 터미널에서도 확인하고 싶다고 하자.

```bash
# 방법 1: 파일로만 저장 — 실시간 확인 불가
./long_build.sh > build.log

# 방법 2: 터미널만 — 저장 없음
./long_build.sh

# 방법 3: tee로 두 곳에 동시 출력
./long_build.sh | tee build.log
```

`tee`는 표준 입력을 읽어 **파일과 표준 출력 모두에 동일하게 쓴다**. 이름은 T자형 배관 이음새(tee joint)에서 유래했다.

## tee 기본 사용법

```bash
ls -la | tee output.txt        # stdout에 표시 + 파일 저장
date | tee -a log.txt          # -a: 파일에 추가(append)
echo "data" | tee a.txt b.txt  # 여러 파일에 동시 저장
```

기본적으로 기존 파일을 덮어쓴다. `-a`를 쓰면 기존 내용 뒤에 추가한다.

![tee — 파이프라인 분기](/assets/posts/linux-tee-flow.svg)

## 파이프라인 중간 디버그

긴 파이프라인의 중간 단계 출력을 확인할 때 `tee`를 끼워 넣으면 편리하다.

```bash
cat data.csv \
  | tee /tmp/step1.csv \
  | grep "error" \
  | tee /tmp/step2.csv \
  | sort | uniq -c
```

각 `tee` 지점에서 중간 데이터를 파일로 저장하면서 파이프라인은 계속 흐른다. 나중에 `/tmp/step1.csv`, `/tmp/step2.csv`를 열어 각 단계 결과를 비교할 수 있다.

## sudo tee — root 파일에 쓰기

리눅스를 쓰다 보면 자주 맞닥뜨리는 함정이 있다.

```bash
# ❌ 이렇게 하면 Permission denied
sudo echo "nameserver 8.8.8.8" > /etc/resolv.conf
```

`sudo`는 `echo`에만 적용되고, `>` 리다이렉션은 **현재 셸(일반 사용자 권한)**이 처리하기 때문에 `/etc/resolv.conf`를 열 수 없다.

```bash
# ✅ sudo tee로 해결
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

`sudo tee`를 쓰면 `tee` 프로세스 자체가 root 권한으로 실행되어 파일을 열 수 있다. stdout 출력이 불필요하다면 `/dev/null`로 버린다.

```bash
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf > /dev/null
```

![tee 실전 사용 예시](/assets/posts/linux-tee-usage.svg)

## 빌드·테스트 로그 기록

CI 환경이 아닌 로컬에서 긴 빌드나 테스트를 실행할 때, 실시간으로 보면서 로그도 남기려면 `tee`가 최선이다.

```bash
# 표준 출력 + 에러를 모두 로그에 저장
make 2>&1 | tee build.log

# 로그만 저장하고 터미널 출력 숨기기
make 2>&1 | tee build.log > /dev/null

# 타임스탬프 추가
make 2>&1 | ts '[%Y-%m-%d %H:%M:%S]' | tee build.log
```

`ts`는 `moreutils` 패키지에 포함된 타임스탬프 도구다.

## process substitution과 tee

Bash의 프로세스 치환을 이용하면 `tee`의 출력을 여러 명령으로 동시에 전달할 수 있다.

```bash
tee >(wc -l) >(grep error > errors.log) < input.txt > /dev/null
```

단, 프로세스 치환은 Bash 전용이므로 `/bin/sh` 스크립트에서는 사용할 수 없다.

---

**지난 글:** [echo & printf: 표준 출력 제어하기](/posts/linux-echo-printf/)

**다음 글:** [read: 스크립트에서 사용자 입력 받기](/posts/linux-read-input/)

<br>
읽어주셔서 감사합니다. 😊
