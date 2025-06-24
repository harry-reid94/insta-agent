import json
import os
import pathlib
import re
from typing import List, Dict

BASE_DIR = pathlib.Path('data/Harry AI')
OUTPUT_PATH = pathlib.Path('data/training_data_v2.jsonl')
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

PHONE_RE = re.compile(r"\+?\d[\d\-\s]{5,}")
URL_RE = re.compile(r"https?://\S+")
NAME_RE = re.compile(r"(?:Luke|Cameron|Cam|Antony|Carrie|Pablo|Brandon|Rebekah|Sasha)", re.I)

STAGES = [
    'greeting', 'rapport_building', 'answering_Q1', 'answering_Q2',
    'answering_Q3', 'answering_Q4', 'qualified', 'nurture',
    'finished', 'human_override'
]

def clean(text: str) -> str:
    text = PHONE_RE.sub('<PHONE>', text)
    text = URL_RE.sub('<URL>', text)
    text = NAME_RE.sub('<NAME>', text)
    return text.strip()


def label_assistant(text: str) -> str:
    """Very naive heuristics to assign a stage label."""
    t = text.lower()
    if any(g in t for g in ('hey', 'hello', 'hi', 'morning', 'evening')):
        return 'greeting'
    if 'how' in t and 'you' in t:
        return 'rapport_building'
    if '?' in t:
        return 'nurture'
    return 'nurture'


def build_examples() -> List[Dict]:
    examples = []
    for root, _, files in os.walk(BASE_DIR):
        for fname in files:
            if not fname.startswith('message_') or not fname.endswith('.json'):
                continue
            fpath = pathlib.Path(root) / fname
            data = json.load(open(fpath, 'r', encoding='utf-8'))
            msgs = data.get('messages', [])
            for i in range(len(msgs) - 1):
                m_user = msgs[i]
                m_assist = msgs[i + 1]
                if (
                    m_user.get('sender_name') != 'Luke Davis'
                    and m_assist.get('sender_name') == 'Luke Davis'
                    and 'content' in m_user and 'content' in m_assist
                ):
                    user_text = clean(m_user['content'])
                    assist_text = clean(m_assist['content'])
                    if not user_text or not assist_text:
                        continue
                    stage = label_assistant(assist_text)
                    record = {
                        'messages': [
                            {
                                'role': 'system',
                                'content': 'You are Luke Davis, responding in your own conversational style.'
                            },
                            {
                                'role': 'user',
                                'content': user_text
                            },
                            {
                                'role': 'assistant',
                                'content': assist_text
                            }
                        ],
                        'metadata': {
                            'stage': stage
                        }
                    }
                    examples.append(record)
    return examples


def main():
    examples = build_examples()
    with OUTPUT_PATH.open('w', encoding='utf-8') as f_out:
        for ex in examples:
            f_out.write(json.dumps(ex, ensure_ascii=False) + '\n')
    print(f'Wrote {len(examples)} examples to {OUTPUT_PATH}')


if __name__ == '__main__':
    main() 