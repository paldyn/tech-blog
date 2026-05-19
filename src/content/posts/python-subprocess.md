---
title: "subprocess: 외부 프로세스 실행하기"
description: "Python subprocess 모듈로 외부 명령어를 실행하는 방법을 설명합니다. subprocess.run(), capture_output, check, Popen, CalledProcessError 등 실무 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "subprocess", "프로세스", "쉘명령", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-shutil/)에서 `shutil`로 파일을 고수준으로 다루는 법을 살펴봤습니다. 이번에는 외부 명령어나 다른 프로그램을 Python 코드에서 실행하는 `subprocess` 모듈을 다룹니다. `os.system()`이라는 오래된 방법도 있지만 출력 캡처가 안 되고 보안 문제도 있어서, 현대 코드에서는 `subprocess.run()`이 표준입니다.

## 기본 사용법 — subprocess.run()

```python
import subprocess

# 간단 실행 (출력 그대로 터미널에 표시)
subprocess.run(["ls", "-la"])

# 출력 캡처 + 텍스트 모드
result = subprocess.run(
    ["ls", "-la"],
    capture_output=True,
    text=True
)
print(result.stdout)
print(result.returncode)  # 0 = 정상
```

`capture_output=True`는 `stdout=subprocess.PIPE, stderr=subprocess.PIPE`의 단축 표기입니다. `text=True`는 바이트 대신 문자열로 받습니다(인코딩은 시스템 기본값).

![subprocess 프로세스 흐름](/assets/posts/python-subprocess-flow.svg)

## check=True — 오류 자동 예외 발생

```python
import subprocess

try:
    result = subprocess.run(
        ["git", "clone", "https://example.com/repo.git"],
        capture_output=True,
        text=True,
        check=True   # returncode != 0 이면 CalledProcessError
    )
except subprocess.CalledProcessError as e:
    print(f"오류 코드: {e.returncode}")
    print(f"stderr: {e.stderr}")
```

`check=True`를 사용하면 외부 명령이 실패했을 때 직접 `returncode`를 확인하지 않아도 됩니다. `CalledProcessError`에는 `returncode`, `stdout`, `stderr` 속성이 모두 담깁니다.

## 입력 데이터 전달 — input 매개변수

```python
import subprocess

# stdin에 데이터를 직접 전달
result = subprocess.run(
    ["grep", "-i", "error"],
    input="INFO: started\nERROR: failed\nINFO: ended",
    capture_output=True,
    text=True
)
print(result.stdout)  # "ERROR: failed\n"
```

파이프(`|`)로 프로세스를 연결하는 쉘 명령은 `Popen`을 활용하거나, 한 프로세스의 `stdout`을 다음 프로세스의 `input`으로 넘기는 방식으로 구현합니다.

## 타임아웃 설정

```python
import subprocess

try:
    result = subprocess.run(
        ["curl", "https://example.com"],
        capture_output=True,
        text=True,
        timeout=10  # 10초 초과 시 TimeoutExpired
    )
except subprocess.TimeoutExpired as e:
    print(f"타임아웃! {e.timeout}초 초과")
```

네트워크 호출이나 장시간 실행 명령에는 항상 `timeout`을 지정합니다. `TimeoutExpired` 발생 시 자식 프로세스는 자동으로 종료됩니다.

## 작업 디렉토리와 환경변수

```python
import subprocess, os

result = subprocess.run(
    ["python", "setup.py", "build"],
    cwd="/home/user/project",          # 작업 디렉토리
    env={**os.environ, "BUILD": "1"},  # 환경변수 추가
    capture_output=True,
    text=True
)
```

`env`를 지정할 때 `{**os.environ, ...}`처럼 기존 환경변수를 상속하지 않으면 `PATH`도 없어져서 명령어를 못 찾는 문제가 생깁니다.

![subprocess 코드 패턴](/assets/posts/python-subprocess-code.svg)

## shell=True — 주의 필요

```python
import subprocess

# 편리하지만 보안 위험
result = subprocess.run(
    "ls -la | grep .py",
    shell=True,
    capture_output=True,
    text=True
)

# 사용자 입력을 절대 포함하면 안 됨 (명령 인젝션)
# user_input = "; rm -rf /"
# subprocess.run(f"echo {user_input}", shell=True)  # 위험!
```

`shell=True`는 쉘 파이프(`|`), 리다이렉션(`>`)이 필요할 때 편리하지만, 외부 입력을 명령에 포함하면 명령 인젝션 공격에 노출됩니다. 리스트 형식으로 인수를 분리해서 쓰는 것이 안전합니다.

## Popen — 비동기 실행과 스트리밍

```python
import subprocess

# 실시간 출력 처리 (로그 스트리밍 등)
with subprocess.Popen(
    ["tail", "-f", "app.log"],
    stdout=subprocess.PIPE,
    text=True
) as proc:
    for line in proc.stdout:
        if "ERROR" in line:
            print(f"발견: {line.rstrip()}")
            proc.terminate()
            break
```

`subprocess.run()`은 완료까지 차단(block)하지만 `Popen`은 비동기로 프로세스를 시작합니다. `communicate()` 메서드로 입출력을 한 번에 주고받거나, `stdout` 스트림을 직접 순회할 수 있습니다.

## 파이프 연결 — 두 프로세스 연결

```python
import subprocess

# ps aux | grep python
ps = subprocess.Popen(["ps", "aux"], stdout=subprocess.PIPE)
grep = subprocess.Popen(
    ["grep", "python"],
    stdin=ps.stdout,
    stdout=subprocess.PIPE,
    text=True
)
ps.stdout.close()  # ps가 SIGPIPE를 받을 수 있게
output, _ = grep.communicate()
print(output)
```

## 정리 — 언제 무엇을

| 상황 | 방법 |
|------|------|
| 간단 실행, 출력 필요 | `subprocess.run(..., capture_output=True, text=True)` |
| 실패 시 즉시 예외 | `check=True` 추가 |
| stdin 데이터 전달 | `input="..."` 추가 |
| 타임아웃 필요 | `timeout=N` 추가 |
| 실시간 출력 / 비동기 | `subprocess.Popen()` 직접 사용 |
| 쉘 파이프 필요 | `shell=True` (입력값 없을 때만) |

---

**지난 글:** [shutil: 고수준 파일 복사·이동·압축](/posts/python-shutil/)

**다음 글:** [glob과 fnmatch: 파일 패턴 매칭](/posts/python-glob-fnmatch/)

<br>
읽어주셔서 감사합니다. 😊
