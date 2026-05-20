---
title: "grep/egrep/fgrep 텍스트 검색"
description: "grep, egrep(grep -E), fgrep(grep -F)의 차이와 주요 옵션, BRE/ERE 정규식 패턴, 재귀 검색, 컨텍스트 출력, 파이프라인 활용 실전 예제를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["grep", "egrep", "fgrep", "regex", "linux", "text-processing", "shell", "BRE", "ERE"]
featured: false
draft: false
---

[지난 글](/posts/bash-shellcheck/)에서 ShellCheck으로 스크립트 품질을 높이는 방법을 살펴봤습니다. 이번부터는 텍스트 처리 도구 시리즈로, `grep`을 시작으로 `sed`, `awk` 순서로 다룹니다. grep은 리눅스에서 가장 빈번하게 쓰이는 도구 중 하나로, 로그 분석, 코드 검색, 파이프라인 필터링 등 어디서나 등장합니다.

## grep / egrep / fgrep의 관계

현대 GNU grep에서 세 명령은 모두 `grep`의 별칭입니다.

```bash
grep   = grep -G   # BRE (Basic Regular Expressions)
egrep  = grep -E   # ERE (Extended Regular Expressions)
fgrep  = grep -F   # Fixed string (고정 문자열, 정규식 없음)
```

`egrep`과 `fgrep`은 구식으로 취급되어 일부 환경에서는 deprecated 경고가 뜰 수 있습니다. 새 스크립트에서는 `grep -E`, `grep -F` 형태를 쓰는 것이 권장됩니다.

![grep / egrep / fgrep 비교](/assets/posts/linux-grep-variants.svg)

## BRE vs ERE 차이점

BRE에서는 `+`, `?`, `|`, `()`, `{}`를 특수 문자로 쓰려면 백슬래시가 필요합니다. ERE에서는 그냥 씁니다.

```bash
# BRE: 백슬래시 필요
grep 'a\{2,4\}' file.txt    # a가 2~4개 연속
grep 'go\+d' file.txt        # good, goood 등

# ERE: 그냥 사용
grep -E 'a{2,4}' file.txt
grep -E 'go+d' file.txt
grep -E 'cat|dog' file.txt   # cat 또는 dog
grep -E '(cat|dog)s?' file.txt  # cats, dogs, cat, dog
```

실무에서는 `-E` 옵션을 거의 항상 사용합니다. BRE 문법은 기억하기 불편하고 실수하기 쉽습니다.

## 주요 옵션

```bash
# 대소문자 무시
grep -i "error" log.txt

# 반전: 패턴 불일치 줄
grep -v "debug" log.txt

# 라인 번호 표시
grep -n "TODO" source.py

# 파일명만 출력 (매칭 파일 목록)
grep -l "import" src/*.py

# 매칭 개수
grep -c "GET" access.log

# 재귀 검색 (심볼릭 링크 포함: -R)
grep -r "password" /etc/

# 단어 경계 (word boundary)
grep -w "log" file.txt    # "log" 매칭, "logging"은 매칭 안 됨

# 전체 줄 일치
grep -x "exact line" file.txt
```

## 컨텍스트 옵션 (-A, -B, -C)

```bash
# 매칭 줄 이후 3줄 출력
grep -A 3 "Exception" app.log

# 매칭 줄 이전 2줄 출력
grep -B 2 "Error" app.log

# 앞뒤 각 3줄 출력 (-C = --context)
grep -C 3 "CRITICAL" syslog

# 여러 패턴 파일에서 읽기
grep -f patterns.txt logfile
```

## 실전 예제

![grep 실전 예제](/assets/posts/linux-grep-examples.svg)

```bash
# 로그에서 ERROR만 카운트
grep -c "ERROR" /var/log/app.log

# 여러 패턴 (OR) — ERE
grep -E "error|warn|critical" /var/log/syslog

# 매칭 부분만 추출 (-o)
grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' access.log

# 빈 줄과 주석 줄 제외하고 설정 파일 읽기
grep -vE '^\s*#|^\s*$' /etc/ssh/sshd_config

# 특정 확장자 파일에서 함수 정의 찾기
grep -rn "^def " --include="*.py" src/

# 특정 확장자 제외
grep -r "TODO" --exclude="*.min.js" .

# 고정 문자열 검색 (. * 등이 리터럴로)
grep -F "a.b*c" file.txt
```

## 종료 코드 활용

```bash
# grep의 종료 코드: 0=매칭, 1=불일치, 2=오류
if grep -q "pattern" file.txt; then
  echo "발견"
else
  echo "없음"
fi

# -q: 조용히 (출력 없이 종료 코드만)
grep -q "ERROR" app.log && send_alert
```

## grep과 파이프라인

```bash
# 프로세스에서 특정 프로세스 찾기
ps aux | grep -v grep | grep "nginx"

# 로그 실시간 모니터링
tail -f /var/log/syslog | grep --line-buffered "error"

# 여러 파일 중 특정 패턴 있는 파일 수정
grep -rl "old_function" src/ | xargs sed -i 's/old_function/new_function/g'
```

`--line-buffered` 옵션은 `tail -f`처럼 스트림 입력에서 grep이 버퍼를 즉시 플러시하도록 합니다. 없으면 버퍼가 찰 때까지 출력이 지연됩니다.

---

**지난 글:** [ShellCheck: 쉘 스크립트 정적 분석](/posts/bash-shellcheck/)

**다음 글:** [sed 기초](/posts/linux-sed-basics/)

<br>
읽어주셔서 감사합니다. 😊
