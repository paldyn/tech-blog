---
title: "diff · patch — 파일 비교와 패치 적용"
description: "diff로 파일 차이를 unified 형식으로 추출하고, patch로 다른 시스템에 변경사항을 적용하는 전체 워크플로우를 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["diff", "patch", "텍스트처리", "Linux", "버전관리"]
featured: false
draft: false
---

[지난 글](/posts/linux-wc-nl/)에서 wc와 nl로 파일 통계를 측정하고 행 번호를 붙이는 방법을 살펴봤습니다. 이번 글에서는 두 파일 또는 디렉터리의 차이를 비교하는 `diff`와, 그 차이를 다른 파일에 적용하는 `patch`를 다룹니다. Git이 내부적으로 사용하는 unified diff 형식을 이해하면 코드 리뷰와 서버 설정 배포에도 도움이 됩니다.

![diff · patch 흐름 다이어그램](/assets/posts/linux-diff-patch-overview.svg)

## diff — 파일 차이 비교

`diff`는 두 파일을 비교해 차이점을 출력합니다. 종료 코드로도 결과를 알 수 있습니다. 같으면 `0`, 다르면 `1`, 오류면 `2`입니다.

```bash
# 두 파일 비교 (기본 형식)
diff old.txt new.txt

# unified 형식 (-u) — 컨텍스트 포함, 가장 널리 쓰임
diff -u old.txt new.txt
```

### unified diff 형식 읽기

`diff -u`의 출력은 다음 구조를 가집니다.

```
--- a/config.txt   2026-05-20
+++ b/config.txt   2026-05-22
@@ -1,5 +1,6 @@
 공통 줄 (앞뒤 3줄 컨텍스트)
-삭제된 줄
+추가된 줄
 공통 줄
```

`@@` 헤더는 `@@ -원본시작줄,줄수 +새파일시작줄,줄수 @@` 형식입니다. `-` 접두사가 붙은 줄은 원본에서 사라지고, `+` 접두사 줄은 새 파일에 추가됩니다.

### 주요 옵션

```bash
# 컨텍스트 줄 수 지정 (기본 3, -U 0이면 변경 줄만)
diff -U 5 old.txt new.txt

# 공백 변화 무시
diff -w a.txt b.txt      # 모든 공백
diff -b a.txt b.txt      # 양 끝 공백 무시

# 대소문자 무시
diff -i a.txt b.txt

# 빈 줄 무시
diff -B a.txt b.txt
```

### 디렉터리 재귀 비교

```bash
# 두 디렉터리의 차이 파일 목록
diff -rq dir1/ dir2/

# 파일 내용 포함해 unified diff
diff -ru dir1/ dir2/

# diff 결과를 패치 파일로 저장
diff -ru dir1/ dir2/ > project.patch
```

---

## patch — 패치 파일 적용

`patch`는 diff 출력을 읽어 원본 파일에 변경사항을 적용합니다.

```bash
# 단순 파일에 적용
patch old.txt < changes.patch

# 표준입력으로
diff -u old.txt new.txt | patch old.txt
```

### -p: 경로 스트립

`diff -r`로 만든 패치 파일의 경로는 `a/path/to/file`, `b/path/to/file` 형식입니다. `-p1`은 첫 번째 경로 구성 요소(`a/` 또는 `b/`)를 제거합니다.

```bash
# 소스 루트에서 -p1로 적용
cd /path/to/project
patch -p1 < changes.patch
```

리눅스 커널 패치를 적용할 때 `-p1`을 쓰는 것이 관례입니다.

![diff · patch 실전 코드 패턴](/assets/posts/linux-diff-patch-code.svg)

### --dry-run: 미리 검증

```bash
# 실제 파일을 바꾸지 않고 패치 적용 가능 여부 확인
patch --dry-run -p1 < changes.patch
```

패치를 배포 서버에 적용하기 전 먼저 `--dry-run`으로 충돌 여부를 확인하는 습관을 들이세요.

### -R: 역방향 적용 (롤백)

```bash
# 이미 적용된 패치를 되돌리기
patch -R -p1 < changes.patch
```

### 충돌 처리

패치가 일부 실패하면 `.rej` 파일에 충돌 내용이 저장됩니다.

```bash
patch -p1 < changes.patch
# Hunk #1 FAILED at 12.
# 1 out of 2 hunks FAILED -- saving rejects to file config.txt.rej

# .rej 파일 확인 후 수동 수정
cat config.txt.rej
```

---

## 실전 워크플로우

### 설정 파일 배포

```bash
# 로컬에서 수정 사항을 패치로 생성
diff -u /etc/nginx/nginx.conf nginx.conf.new > nginx.patch

# 원격 서버에서 적용
scp nginx.patch server:/tmp/
ssh server "cd / && patch -p0 < /tmp/nginx.patch && nginx -t && systemctl reload nginx"
```

### 코드 변경 검토 후 적용

```bash
# 변경 내용 미리 검토
diff -u main.py main_new.py | less

# 문제 없으면 적용
diff -u main.py main_new.py | patch main.py
```

### 두 디렉터리 동기화

```bash
# 변경 파일만 목록으로 확인
diff -rq prod/ staging/

# 패치로 차이 적용
diff -ru prod/ staging/ | patch -p1 -d /target/
```

## diff의 종료 코드를 스크립트에서 활용

```bash
if diff -q file1 file2 > /dev/null 2>&1; then
  echo "동일합니다"
else
  echo "다릅니다"
fi
```

## 정리

| 명령어 | 역할 |
|--------|------|
| `diff -u` | unified 형식 비교 |
| `diff -ru dir1 dir2` | 디렉터리 재귀 비교 |
| `diff -w` | 공백 무시 비교 |
| `patch -p1` | unified patch 적용 |
| `patch --dry-run` | 실제 변경 없이 검증 |
| `patch -R` | 롤백 |

---

**지난 글:** [wc · nl — 줄/단어/문자 세기와 행 번호](/posts/linux-wc-nl/)

**다음 글:** [comm · cmp — 파일 집합 연산과 바이너리 비교](/posts/linux-comm-cmp/)

<br>
읽어주셔서 감사합니다. 😊
