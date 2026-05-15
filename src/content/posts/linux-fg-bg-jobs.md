---
title: "fg, bg, jobs — 포그라운드·백그라운드 작업 관리"
description: "리눅스 job control의 개념, Ctrl+Z로 작업 정지, fg/bg로 상태 전환, jobs 명령으로 작업 목록 관리, wait 내장 명령으로 병렬 작업을 제어하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "jobs", "fg", "bg", "job-control", "background", "foreground", "shell", "bash"]
featured: false
draft: false
---

[지난 글](/posts/linux-nice-renice/)에서 프로세스의 CPU 우선순위를 nice 값으로 조정하는 법을 배웠습니다. 이번엔 터미널 세션 안에서 여러 작업을 동시에 다루는 **작업 제어(Job Control)**를 살펴봅니다.

## 작업 제어란

터미널(셸)에서 실행되는 각 명령이나 파이프라인은 **작업(job)**입니다. 작업 제어는 이 작업들을 포그라운드·백그라운드 사이에서 이동하고, 일시 정지하고, 재개하는 기능입니다.

셸은 실행 중인 작업을 `[1]`, `[2]` 같은 **작업 번호(job number)**로 추적합니다. PID와 다른 셸 내부 번호입니다.

## 기본 흐름

![작업 제어 흐름 — 포그라운드·백그라운드·정지 전환](/assets/posts/linux-fg-bg-jobs-flow.svg)

### 백그라운드로 시작 (`&`)

```bash
# 명령 끝에 &를 붙이면 즉시 백그라운드 실행
sleep 100 &         # [1] 3456 출력
make -j4 &          # [2] 4567 출력
```

셸은 `[job_number] PID` 형식으로 작업 번호와 PID를 출력하고 프롬프트로 돌아옵니다.

### Ctrl+Z — 실행 중 작업 일시 정지

```bash
vim /etc/config     # 편집 시작
# Ctrl+Z 누름
# [1]+  Stopped    vim /etc/config
```

SIGTSTP 시그널이 전송되어 프로세스가 T(Stopped) 상태가 되고 프롬프트가 돌아옵니다. vim이 편집 중인 내용은 그대로 유지됩니다.

### jobs — 작업 목록 확인

```bash
jobs        # 간단 목록
jobs -l     # PID 포함 목록
jobs -r     # Running 중인 작업만
jobs -s     # Stopped 상태만
```

```
[1]- 1234 Running    sleep 100 &
[2]+ 1235 Stopped    vim config
```

`+`는 현재 기본 작업(fg나 bg 인수 없이 실행 시 대상), `-`는 이전 작업입니다.

### fg — 작업을 포그라운드로

```bash
fg          # 현재(+) 작업 포그라운드로
fg %2       # 작업 번호 2를 포그라운드로
fg %vim     # 이름으로 지정 (접두사 매칭)
```

### bg — 정지된 작업을 백그라운드에서 재개

```bash
bg          # 현재(+) 작업 백그라운드로 재개
bg %1       # 작업 번호 1을 백그라운드로 재개
```

## 실전 패턴

![fg · bg · jobs 실전 패턴](/assets/posts/linux-fg-bg-jobs-code.svg)

### 편집기와 셸을 번갈아 쓰기

```bash
vim myfile.py       # 편집 중
# Ctrl+Z → Stopped
python myfile.py    # 실행 확인
# Ctrl+Z → 이 작업도 Stopped
fg %vim             # vim으로 돌아가기
# 다시 Ctrl+Z
fg %python          # python으로 전환
```

### 병렬 작업과 wait

```bash
#!/bin/bash
# 여러 작업을 병렬로 시작하고 모두 완료되길 기다림
gzip file1.log &
gzip file2.log &
gzip file3.log &
wait                # 모든 백그라운드 작업 완료 대기
echo "압축 완료"
```

각 `&` 직후 `$!` 변수에 가장 최근 백그라운드 PID가 저장됩니다.

```bash
# 각 PID를 저장해 선택적 대기
task_a &; PID_A=$!
task_b &; PID_B=$!
wait $PID_A         # task_a만 기다림
echo "A 완료, B는 아직 실행 중"
wait $PID_B
```

### 백그라운드 작업의 출력 처리

백그라운드 작업도 stdout/stderr가 터미널에 출력됩니다. 프롬프트 중간에 출력이 끼어드는 게 불편하면 리다이렉션을 추가합니다.

```bash
./build.sh > build.log 2>&1 &
tail -f build.log           # 실시간 진행 확인
```

## 작업 종료

```bash
# 특정 작업 종료 (SIGTERM)
kill %1
kill %vim

# 모든 백그라운드 작업 종료
kill $(jobs -rp)

# 작업 번호를 모른다면
kill %?make         # make가 포함된 이름의 작업
```

## 주의: 터미널 종료 시

로그아웃하거나 터미널을 닫으면 셸은 포그라운드·백그라운드 작업에 **SIGHUP**을 보냅니다. 대부분의 프로세스는 이를 받고 종료합니다. 터미널 종료 후에도 작업을 유지하는 방법은 다음 글의 `nohup`과 `disown`에서 다룹니다.

---

**지난 글:** [nice와 renice — 프로세스 CPU 우선순위 조정](/posts/linux-nice-renice/)

**다음 글:** [nohup과 disown — 터미널 종료 후에도 프로세스 유지하기](/posts/linux-nohup-disown/)

<br>
읽어주셔서 감사합니다. 😊
