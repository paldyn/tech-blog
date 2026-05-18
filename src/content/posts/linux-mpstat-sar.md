---
title: "mpstat과 sar — CPU별 사용률과 히스토리 수집"
description: "mpstat으로 CPU 코어별 사용률을 실시간 분석하고, sar로 시스템 성능 데이터를 장기 수집·조회하는 방법을 설명합니다. 단일 스레드 병목 진단과 성능 히스토리 분석법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "mpstat", "sar", "cpu", "performance", "sysstat", "monitoring", "history"]
featured: false
draft: false
---

[지난 글](/posts/linux-iostat/)에서 디스크 I/O 병목을 진단하는 방법을 배웠습니다. 디스크 문제가 아닌데 시스템이 느리다면 CPU를 의심해야 합니다. `mpstat`은 **코어별 CPU 사용률**을 보여 주어 단일 스레드 병목을 즉시 발견할 수 있고, `sar`는 수일·수주치 성능 데이터를 기록해 두었다가 조회하는 히스토리 도구입니다.

## mpstat — 코어별 사용률

```bash
# 모든 CPU 코어 실시간 (1초 간격, 5회)
mpstat -P ALL 1 5

# 특정 코어만 (0번, 2번)
mpstat -P 0,2 1 3

# 인터럽트 분포 포함
mpstat -I ALL 1 3
```

![mpstat — CPU별 사용률 분석](/assets/posts/linux-mpstat-output.svg)

## 단일 스레드 병목 진단

`top`이나 vmstat에서 전체 CPU 사용률은 낮은데 체감 성능이 떨어진다면 특정 코어만 포화된 경우입니다.

```bash
# CPU 0이 87%, 나머지는 한 자릿수 → 단일 스레드 병목
mpstat -P ALL 1 | awk 'NR>4 && $3!="CPU" {
  cpu=$3; idle=$NF; used=100-idle
  if (used > 70) printf "CPU %s: %.1f%%\n", cpu, used
}'

# 해당 프로세스 찾기
ps -eo pid,psr,pcpu,comm | awk '$3>50' | sort -k3 -rn | head
# psr: 현재 실행 중인 CPU 번호
```

## CPU 어피니티 조정

특정 CPU에 집중되는 단일 스레드 프로세스는 `taskset`으로 분산하거나, 멀티스레드 설계로 전환해야 합니다.

```bash
# PID 1234를 CPU 0,1,2,3에 바인딩
taskset -cp 0-3 1234

# 처음부터 특정 CPU에서 실행
taskset -c 2 ./myapp
```

## sar — 시스템 활동 기록기

`sar`는 `sysstat` 패키지의 핵심 도구로, 수집 데몬(`sadc`)이 주기적으로 `/var/log/sa/saDD` 파일에 성능 데이터를 기록합니다.

```bash
# Ubuntu에서 수집 활성화
sed -i 's/ENABLED="false"/ENABLED="true"/' /etc/default/sysstat
systemctl enable --now sysstat

# 수집 주기 확인/변경
cat /etc/cron.d/sysstat
```

![sar — 시스템 활동 기록과 조회](/assets/posts/linux-sar-overview.svg)

## sar 실시간 모니터링

```bash
sar -u 1 5        # CPU 사용률 (1초 × 5회)
sar -r 1 5        # 메모리 사용률
sar -d 1 5        # 디스크 I/O
sar -n DEV 1 5    # 네트워크 트래픽
sar -q 1 5        # 부하 평균 + 실행 큐
```

## sar 히스토리 조회

장애 발생 직전 몇 시간의 CPU/메모리 트렌드를 보고 싶을 때 `sar`의 진가가 드러납니다.

```bash
# 오늘 18일 데이터
sar -u -f /var/log/sa/sa18

# 10:00 ~ 12:00 범위만
sar -u -s 10:00:00 -e 12:00:00 -f /var/log/sa/sa18

# 어젯밤 자정 전후 메모리 급증 확인
sar -r -f /var/log/sa/sa17 -s 23:00 -e 01:00

# CSV로 내보내기 (Grafana 등 연동)
sadf -d /var/log/sa/sa18 -- -u > cpu_history.csv
```

`sar`는 장애 보고서 작성, 용량 계획, SLA 리포팅에 필수 도구입니다. 서버를 처음 설정할 때 sysstat 수집을 켜 두면 나중에 후회하지 않습니다.

---

**지난 글:** [iostat — 디스크 I/O 통계와 성능 분석](/posts/linux-iostat/)

**다음 글:** [free — 메모리 사용량 정확하게 읽기](/posts/linux-free-memory/)

<br>
읽어주셔서 감사합니다. 😊
