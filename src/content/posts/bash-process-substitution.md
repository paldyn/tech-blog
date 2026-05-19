---
title: "Bash 프로세스 치환"
description: "Bash 프로세스 치환 <(cmd)와 >(cmd)의 동작 원리와 파이프와의 차이를 설명합니다. while 루프에서 변수 범위를 보존하는 패턴, diff·comm·tee와의 결합 활용을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["bash", "process-substitution", "pipe", "fifo", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-here-doc-here-string/)에서 Here Document와 Here String으로 텍스트를 stdin에 주입하는 방법을 배웠습니다. 이번엔 명령 출력 자체를 파일처럼 사용할 수 있게 해 주는 **프로세스 치환**을 다룹니다.

## 프로세스 치환이란

`<(cmd)` 형태를 프로세스 치환(process substitution)이라고 합니다. Bash는 이것을 `/dev/fd/63`과 같은 특수 파일 경로로 교체하고, 백그라운드에서 `cmd`를 실행해 그 stdout을 해당 경로로 연결합니다.

```bash
# 이렇게 쓰면
diff <(sort file1.txt) <(sort file2.txt)

# Bash 내부적으로 이런 일이 일어남
sort file1.txt > /dev/fd/63 &   # 백그라운드
sort file2.txt > /dev/fd/62 &   # 백그라운드
diff /dev/fd/63 /dev/fd/62
```

결과적으로 명령이 파일 경로를 기대하는 자리에 명령 출력을 바로 넣을 수 있습니다.

![프로세스 치환 개념](/assets/posts/bash-process-substitution-concept.svg)

## 파이프와의 결정적 차이 — 변수 범위

파이프라인에서 오른쪽 명령은 서브셸에서 실행됩니다. 그래서 while 루프 안에서 변수를 바꿔도 루프 바깥에서는 보이지 않습니다.

```bash
# ❌ 파이프 방식 — count가 서브셸에서만 증가
count=0
find . -name "*.log" | while IFS= read -r f; do
    (( count++ ))
done
echo "$count"   # 0  ← 항상 0

# ✅ 프로세스 치환 — while이 현재 셸에서 실행
count=0
while IFS= read -r f; do
    (( count++ ))
done < <(find . -name "*.log")
echo "$count"   # 실제 파일 수
```

`done < <(cmd)` 형태에서 첫 `<`는 리다이렉션, 두 번째 `<(`는 프로세스 치환입니다.

## <(cmd) — 읽기 치환

```bash
# 두 명령 출력을 파일 없이 diff
diff <(ls /etc | sort) <(ls /usr/etc | sort)

# 원격 파일과 로컬 파일 비교
diff <(ssh server "cat /etc/nginx/nginx.conf") /etc/nginx/nginx.conf

# comm으로 공통 줄 찾기 (정렬된 입력 필요)
comm -12 <(sort file1.txt) <(sort file2.txt)

# paste로 두 명령 출력을 열 방향 병합
paste <(cut -d: -f1 /etc/passwd) <(cut -d: -f6 /etc/passwd)
```

![프로세스 치환 실전 패턴](/assets/posts/bash-process-substitution-patterns.svg)

## >(cmd) — 쓰기 치환

`>(cmd)` 형태를 쓰면 파일에 쓰듯 명령에 데이터를 보낼 수 있습니다.

```bash
# tee로 동시에 여러 명령에 보내기
generate_data | tee >(gzip > output.gz) >(wc -l > count.txt) > /dev/null

# 로그를 동시에 화면과 파일로
make 2>&1 | tee >(grep "error" > errors.log)
```

## 프로세스 치환 + mapfile

```bash
# 명령 출력을 배열로 (서브셸 없이)
mapfile -t files < <(find . -name "*.sh" | sort)
echo "발견된 스크립트: ${#files[@]}개"

for f in "${files[@]}"; do
    echo "처리: $f"
done
```

`find ... | mapfile`이 아니라 `mapfile < <(find ...)`를 쓰면 mapfile이 현재 셸에서 실행되어 배열이 바깥에서 보입니다.

## 주의사항

```bash
# ksh/sh에서는 지원하지 않음 — Bash, Zsh 전용
# /proc/self/fd 경로 기반 — WSL 등에서는 다를 수 있음

# 오류 처리가 어려움
# cmd가 실패해도 메인 명령에서 오류로 잡기 어려움
diff <(cmd_that_fails) file.txt   # diff는 성공 가능
```

프로세스 치환 안의 명령 오류는 `pipefail` 옵션을 켜도 잡히지 않을 수 있습니다. 신뢰성이 중요한 경우 임시 파일을 명시적으로 만들어 사용하는 것이 더 안전합니다.

---

**지난 글:** [Bash Here Document와 Here String](/posts/bash-here-doc-here-string/)

**다음 글:** [Bash 산술 연산](/posts/bash-arithmetic/)

<br>
읽어주셔서 감사합니다. 😊
