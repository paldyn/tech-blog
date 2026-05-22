---
title: "SCP vs rsync — 실무에서 무엇을 선택해야 하나"
description: "SCP와 rsync의 전송 방식 차이, 대용량 파일·증분 백업·삭제 동기화 시나리오별 선택 기준과 OpenSSH 9.0 이후 scp 변화를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "scp", "rsync", "file-transfer", "backup", "delta-transfer", "ssh", "comparison"]
featured: false
draft: false
---

[지난 글](/posts/linux-rsync-options/)에서 rsync의 주요 옵션을 살펴봤습니다. 그렇다면 실무에서 SCP와 rsync 중 무엇을 골라야 할까요? 두 도구 모두 SSH를 암호화 채널로 사용하지만 내부 동작 방식이 다르고, 장단점이 뚜렷합니다. 이 글에서는 구체적인 시나리오를 통해 선택 기준을 정리합니다.

## SCP는 무엇이 다른가

SCP는 원래 BSD의 `rcp`를 SSH로 감싼 도구입니다. 파일 전송 논리가 단순합니다. 원본 파일을 통째로 읽어서 암호화 채널로 보내고, 목적지에 씁니다. 체크섬 협상도 없고 델타 계산도 없습니다. 이 단순함이 강점이기도 하고 한계이기도 합니다.

```bash
# 단일 파일 복사
scp deploy.jar user@prod:/opt/app/

# 디렉터리 재귀 복사 (-r)
scp -r ./dist user@cdn:/var/www/html/

# 속도 제한 (-l: Kbit/s 단위)
scp -l 8192 large.tar.gz user@host:~/   # 1MB/s
```

## rsync는 무엇이 다른가

rsync는 파일을 블록으로 나눠 원격 측의 블록 체크섬과 비교한 뒤 달라진 부분만 전송합니다. 이 **델타 전송 알고리즘**이 핵심입니다. 처음 전송할 때는 SCP보다 약간 느릴 수 있지만, 두 번째부터는 변경 블록만 전송하므로 훨씬 효율적입니다.

```bash
# 기본 증분 동기화
rsync -avz src/ user@host:dst/

# 완전 미러 (삭제 동기화 포함)
rsync -avz --delete src/ user@host:dst/

# 중단 재개 가능
rsync -avz --partial --progress large.iso user@host:~/
```

![SCP vs rsync 완전 비교](/assets/posts/linux-scp-vs-rsync-comparison.svg)

## 성능 비교: 언제 무엇이 빠른가

**첫 번째 전송**: 거의 동일. rsync는 체크섬 협상 오버헤드가 있어 소파일이 많으면 SCP가 조금 더 빠릅니다.

**두 번째 전송 (파일 일부 변경)**: rsync가 압도적으로 빠릅니다. 1GB 파일에서 10MB만 바뀐 경우 SCP는 1GB를 전송하고, rsync는 10MB+오버헤드만 전송합니다.

**소용량 파일 다수**: SCP가 유리할 수 있습니다. rsync는 파일마다 체크섬 협상을 수행하므로 파일 수가 많을수록 오버헤드가 쌓입니다. (`--no-whole-file` 옵션 조정으로 개선 가능)

## OpenSSH 9.0 이후 scp 변화

2022년 OpenSSH 9.0부터 `scp` 명령의 내부 프로토콜이 **SCP(레거시)에서 SFTP로 교체**됐습니다. `-O` 옵션을 주면 레거시 SCP 프로토콜을 강제합니다. 실질적인 동작 차이는 거의 없지만, 이 변화는 레거시 SCP 프로토콜이 사실상 deprecated 상태임을 의미합니다. 신규 스크립트에서는 rsync나 sftp를 우선 고려하는 것이 좋습니다.

```bash
# 레거시 SCP 프로토콜 강제 (하위 호환용)
scp -O file user@old-host:/path/
```

![사용 시나리오 결정 가이드](/assets/posts/linux-scp-vs-rsync-usecase.svg)

## 실무 결정 기준

**SCP를 쓸 때**: CI/CD 파이프라인에서 빌드 결과물 하나를 배포 서버로 복사할 때처럼 **한 번, 한 파일, 단순 복사**가 목적이면 SCP가 적합합니다.

**rsync를 쓸 때**: **정기 백업, 대용량 파일, 재시도가 필요한 전송, 디렉터리 미러링**이 목적이면 rsync를 씁니다. 설정 파일 한 줄짜리 상황도 `alias rcp='rsync -avz'` 한 번 정의해두면 rsync로 충분합니다.

```bash
# 실무 배포 스크립트 예 (rsync 사용)
#!/bin/bash
RELEASE="$(date +%Y%m%d_%H%M%S)"
DEST="deploy@web:/srv/releases/$RELEASE"

rsync -avz --exclude='node_modules/' \
  --exclude='.git/' \
  ./build/ "$DEST/"

ssh deploy@web "ln -sfn /srv/releases/$RELEASE /srv/current"
```

버전별 디렉터리에 배포한 뒤 심볼릭 링크로 현재 버전을 가리키는 패턴입니다. rsync의 증분 전송 덕분에 변경된 파일만 전송되고, 롤백도 `ln -sfn` 한 줄로 처리됩니다.

---

**지난 글:** [rsync 옵션 완전 해설](/posts/linux-rsync-options/)

**다음 글:** [screen & tmux — 터미널 멀티플렉서](/posts/linux-screen-tmux/)

<br>
읽어주셔서 감사합니다. 😊
