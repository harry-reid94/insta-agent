import json, os, pathlib, re
from typing import List, Dict

BASE_DIR = pathlib.Path('data/Harry AI')
OUTPUT = pathlib.Path('data/training_data_v3.jsonl')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

PHONE_RE = re.compile(r"\+?\d[\d\-\s]{5,}")
URL_RE = re.compile(r"https?://\S+")
NAME_RE = re.compile(r"(?:Luke|Cameron|Cam|Antony|Carrie|Pablo|Brandon|Rebekah|Sasha)", re.I)

# Stage detection regexes
STAGE_PATTERNS = {
    'greeting': re.compile(r"\b(hey|hi|hello|gm|good (morning|evening|afternoon))\b", re.I),
    'rapport_building': re.compile(r"where (are|r) you|how (has|'s|s) your day|what (brought|brings) you|goal|outcome", re.I),
    'answering_Q1': re.compile(r"understand|familiar|well-versed|how much do you know.*(company|services)", re.I),
    'answering_Q2': re.compile(r"(sparked|spark|what).*interest|why.*interest|what.*brought.*services", re.I),
    'answering_Q3': re.compile(r"portfolio .*size|portfolio worth|how big is.*portfolio|invest(ing|ed)?.*\$|current investment portfolio", re.I),
    'answering_Q4': re.compile(r"biggest (challenge|struggle)|pain point|what.*challenges.*invest", re.I),
    'qualified': re.compile(r"congratulations|schedule|booking link|book.*consult", re.I),
    'nurture': re.compile(r"not qualified|faq|check in (a few|couple) days", re.I),
}

DEFAULT_STAGE = 'nurture'


def clean(text: str) -> str:
    text = PHONE_RE.sub('<PHONE>', text)
    text = URL_RE.sub('<URL>', text)
    text = NAME_RE.sub('<NAME>', text)
    return text.strip()


def detect_stage(text: str) -> str:
    for stage, pattern in STAGE_PATTERNS.items():
        if pattern.search(text):
            return stage
    return DEFAULT_STAGE


def build() -> List[Dict]:
    examples = []
    for root, _, files in os.walk(BASE_DIR):
        for fname in files:
            if not fname.startswith('message_') or not fname.endswith('.json'):
                continue
            path = pathlib.Path(root) / fname
            with open(path, 'r', encoding='utf-8') as f:
                convo = json.load(f)
            msgs = convo.get('messages', [])
            for i in range(len(msgs) - 1):
                m_user = msgs[i]
                m_assist = msgs[i+1]
                if m_user.get('sender_name') == 'Luke Davis':
                    continue
                if m_assist.get('sender_name') != 'Luke Davis':
                    continue
                if 'content' not in m_user or 'content' not in m_assist:
                    continue
                user_text = clean(m_user['content'])
                assist_text = clean(m_assist['content'])
                if not user_text or not assist_text:
                    continue
                stage = detect_stage(assist_text)
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
    examples = build()
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        for ex in examples:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    print(f'Wrote {len(examples)} examples to {OUTPUT}')


if __name__ == '__main__':
    main() 