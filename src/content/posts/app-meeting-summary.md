---
title: "AI 회의 요약 시스템: 음성 인식부터 인사이트 추출까지"
description: "회의 녹음을 텍스트로 변환하고, 화자를 분리하며, 요약·결정사항·액션아이템을 자동으로 추출해 Slack·Notion·Jira에 배포하는 AI 회의 요약 시스템을 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["회의요약", "STT", "Whisper", "화자분리", "액션아이템", "Slack연동", "생산성자동화"]
featured: false
draft: false
---

[지난 글](/posts/app-form-automation/)에서 폼과 서류 자동화를 구현했다. 시리즈 마지막 애플리케이션으로 **AI 회의 요약 시스템**을 다룬다. 60분짜리 회의에서 핵심 결정사항과 각자 해야 할 일을 뽑아내는 데 20~30분을 또 쓰는 것은 낭비다. AI가 회의 녹음을 받아 자동으로 요약, 결정사항, 액션아이템을 추출하고 Slack과 Notion에 배포까지 해준다면 회의 후 생산성이 크게 올라간다.

## 파이프라인 개요

회의 요약 파이프라인은 4단계로 구성된다.

1. **음성 → 텍스트 변환(STT)**: Whisper 또는 클라우드 STT API
2. **화자 분리(Speaker Diarization)**: 누가 말했는지 구분
3. **회의록 구조화**: 타임스탬프 + 화자 + 발언 내용
4. **AI 분석 및 요약**: 요약, 결정사항, 액션아이템, 키워드 추출

![AI 회의 요약 파이프라인](/assets/posts/app-meeting-summary-pipeline.svg)

## STT: 음성을 텍스트로 변환

OpenAI Whisper로 오디오 파일을 텍스트로 변환한다.

```python
import openai
from pathlib import Path

client_oai = openai.OpenAI()

def transcribe_audio(audio_path: str, language: str = "ko") -> dict:
    with open(audio_path, "rb") as f:
        transcript = client_oai.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language=language,
            response_format="verbose_json",  # 타임스탬프 포함
            timestamp_granularities=["segment"],
        )

    segments = [
        {
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
        }
        for seg in transcript.segments
    ]

    return {
        "full_text": transcript.text,
        "segments": segments,
        "duration": transcript.duration,
        "language": transcript.language,
    }
```

`verbose_json` 형식으로 받으면 세그먼트별 타임스탬프를 얻을 수 있어 화자 분리와 결합하기 좋다.

## 화자 분리

화자 분리는 "누가 말했는지"를 타임스탬프 기반으로 매핑하는 작업이다. pyannote.audio가 가장 많이 쓰인다.

```python
def diarize_audio(audio_path: str) -> list[dict]:
    from pyannote.audio import Pipeline

    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=HUGGINGFACE_TOKEN,
    )
    diarization = pipeline(audio_path)

    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            "start": turn.start,
            "end": turn.end,
            "speaker": speaker,  # SPEAKER_00, SPEAKER_01 ...
        })
    return segments

def merge_transcript_with_speakers(
    transcript_segments: list[dict],
    speaker_segments: list[dict],
) -> list[dict]:
    result = []
    for t_seg in transcript_segments:
        t_mid = (t_seg["start"] + t_seg["end"]) / 2
        # 발화 중간 시점에 해당하는 화자 찾기
        speaker = "Unknown"
        for s_seg in speaker_segments:
            if s_seg["start"] <= t_mid <= s_seg["end"]:
                speaker = s_seg["speaker"]
                break
        result.append({**t_seg, "speaker": speaker})
    return result
```

## AI 요약 및 정보 추출

화자 구분이 된 전체 회의록을 LLM에게 넘겨 구조화된 요약을 생성한다.

```python
import anthropic
import json

client = anthropic.Anthropic()

def analyze_meeting(transcript: list[dict], participant_names: dict | None = None) -> dict:
    # 화자 코드를 이름으로 치환 (알고 있는 경우)
    if participant_names:
        for seg in transcript:
            seg["speaker"] = participant_names.get(seg["speaker"], seg["speaker"])

    formatted = "\n".join(
        f"[{seg['speaker']} {int(seg['start']//60):02d}:{int(seg['start']%60):02d}] "
        f"{seg['text']}"
        for seg in transcript
    )

    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        system=(
            "회의 내용을 분석해 다음 JSON 형식으로 반환하세요:\n"
            "{\n"
            '  "summary": "3~5문장 요약",\n'
            '  "key_topics": ["주요 주제1", "주제2"],\n'
            '  "decisions": ["결정사항1", "결정사항2"],\n'
            '  "action_items": [{"task": "...", "owner": "...", "due_date": "...", "priority": "high|medium|low"}],\n'
            '  "participants": ["참석자1"],\n'
            '  "next_meeting": "다음 회의 일정 또는 null"\n'
            "}\n\n"
            "액션아이템의 owner는 회의록에서 명시적으로 담당자가 지정된 경우만 입력하고, "
            "불명확하면 null로 남기세요."
        ),
        messages=[{"role": "user", "content": f"회의록:\n{formatted}"}],
    )

    return json.loads(response.content[0].text)
```

![회의 요약 출력 구조](/assets/posts/app-meeting-summary-output.svg)

## 후속 플랫폼 자동 배포

요약 결과를 Slack, Notion, Jira에 자동으로 전송한다.

```python
import requests

def post_to_slack(summary: dict, channel: str, slack_token: str):
    action_items_text = "\n".join(
        f"• [{item.get('priority', 'medium').upper()}] {item['task']}"
        f" — {item.get('owner', 'TBD')}"
        f" (기한: {item.get('due_date', '미정')})"
        for item in summary.get("action_items", [])
    )

    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": "📋 AI 회의 요약"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*요약*\n{summary['summary']}"}},
        {"type": "divider"},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*✅ 결정사항*\n" + "\n".join(f"• {d}" for d in summary.get("decisions", []))},
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*🎯 액션아이템*\n{action_items_text}"},
        },
    ]

    requests.post(
        "https://slack.com/api/chat.postMessage",
        headers={"Authorization": f"Bearer {slack_token}"},
        json={"channel": channel, "blocks": blocks},
    )

def create_notion_page(summary: dict, database_id: str, notion_token: str):
    content_blocks = [
        {"object": "block", "type": "heading_2",
         "heading_2": {"rich_text": [{"type": "text", "text": {"content": "요약"}}]}},
        {"object": "block", "type": "paragraph",
         "paragraph": {"rich_text": [{"type": "text", "text": {"content": summary["summary"]}}]}},
    ]
    for item in summary.get("action_items", []):
        content_blocks.append({
            "object": "block", "type": "to_do",
            "to_do": {
                "rich_text": [{"type": "text", "text": {"content": f"{item['task']} ({item.get('owner', 'TBD')})"}}],
                "checked": False,
            },
        })

    requests.post(
        "https://api.notion.com/v1/pages",
        headers={"Authorization": f"Bearer {notion_token}", "Notion-Version": "2022-06-28"},
        json={
            "parent": {"database_id": database_id},
            "properties": {"Name": {"title": [{"text": {"content": "회의 요약"}}]}},
            "children": content_blocks,
        },
    )
```

## Jira 이슈 자동 생성

액션아이템을 Jira 태스크로 자동 등록한다.

```python
def create_jira_issues(action_items: list[dict], project_key: str, jira_config: dict):
    created = []
    for item in action_items:
        if item.get("priority") in ("high",) or item.get("owner"):
            payload = {
                "fields": {
                    "project": {"key": project_key},
                    "summary": item["task"],
                    "issuetype": {"name": "Task"},
                    "priority": {"name": {"high": "High", "medium": "Medium", "low": "Low"}.get(item.get("priority", "medium"), "Medium")},
                    "assignee": {"name": item.get("owner")} if item.get("owner") else None,
                    "duedate": item.get("due_date"),
                }
            }
            resp = requests.post(
                f"{jira_config['base_url']}/rest/api/3/issue",
                auth=(jira_config["email"], jira_config["api_token"]),
                json=payload,
            )
            if resp.ok:
                created.append({"task": item["task"], "jira_key": resp.json()["key"]})

    return created
```

## 전체 파이프라인 통합

```python
def process_meeting_recording(
    audio_path: str,
    participant_names: dict | None = None,
    post_to: list[str] | None = None,
) -> dict:
    # 1. STT
    transcript_data = transcribe_audio(audio_path)

    # 2. 화자 분리 (선택)
    try:
        speaker_segs = diarize_audio(audio_path)
        merged = merge_transcript_with_speakers(transcript_data["segments"], speaker_segs)
    except Exception:
        merged = transcript_data["segments"]

    # 3. AI 분석
    summary = analyze_meeting(merged, participant_names)

    # 4. 배포
    post_to = post_to or []
    if "slack" in post_to:
        post_to_slack(summary, SLACK_CHANNEL, SLACK_TOKEN)
    if "notion" in post_to:
        create_notion_page(summary, NOTION_DB_ID, NOTION_TOKEN)
    if "jira" in post_to:
        create_jira_issues(summary.get("action_items", []), JIRA_PROJECT, JIRA_CONFIG)

    return {"summary": summary, "deployed_to": post_to}
```

회의 직후 자동으로 실행되도록 Zoom이나 Teams의 webhook과 연동하면 회의가 끝나는 즉시 요약이 Slack으로 날아간다. 지금까지 10개의 AI 애플리케이션 패턴을 살펴봤다. 챗봇부터 회의 요약까지 각각 독립적인 서비스이지만, 함께 구성하면 AI 기반 업무 자동화의 탄탄한 기반이 된다.

---

**지난 글:** [AI 폼·서류 자동화: OCR부터 자동 입력까지](/posts/app-form-automation/)

**다음 글:** [AI 개발을 위한 Python 핵심 라이브러리](/posts/python-for-ai/)

<br>
읽어주셔서 감사합니다. 😊
