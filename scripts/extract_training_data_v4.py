import json, os, pathlib, re
from typing import List, Dict
from ftfy import fix_text

BASE_DIR = pathlib.Path('data/Harry AI')
OUTPUT = pathlib.Path('data/training_data_final.jsonl')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

# --- PII cleaning regexes ---
PHONE_RE = re.compile(r"\+?\d[\d\-\s]{5,}")
URL_RE   = re.compile(r"https?://\S+")
NAME_RE  = re.compile(r"(?:Luke|Cameron|Cam|Antony|Carrie|Pablo|Brandon|Rebekah|Sasha)", re.I)


def clean(text: str) -> str:
    text = fix_text(text)
    text = PHONE_RE.sub('<PHONE>', text)
    text = URL_RE.sub('<URL>', text)
    text = NAME_RE.sub('<NAME>', text)
    # Skip Arabic-like or garbage lines
    if re.fullmatch(r"[\u0600-\u06FF\s]+", text):
        return ""
    return text.strip()

# --- Config-derived keywords ---
GREETING_KEYWORDS = {"hey", "hi", "hello", "morning", "evening"}
RAPPORT_KEYWORDS  = {"where", "how", "goal", "brought", "outcome"}
Q1_KW = {"understanding", "company", "services"}
Q2_KW = {"interest", "spark"}
Q3_KW = {"portfolio", "size", "invest", "$", "k"}
Q4_KW = {"challenge", "pain", "struggle"}
BOOKING_KW = {"booking", "schedule", "consult", "link", "calendar"}

STAGE_IDS = {
    'greeting':'greeting',
    'rapport':'rapport_building',
    'Q1':'answering_Q1',
    'Q2':'answering_Q2',
    'Q3':'answering_Q3',
    'Q4':'answering_Q4',
    'qualified':'qualified',
    'nurture':'nurture'
}

# ---------- Style tokens -----------
STYLE_TOKENS = [
    # Common suffixes / greetings
    "bro",
    "brother",
    "mate",
    "legend",
    "my man",
    "champ",

    # Luke-isms & shorthand
    "nice man",
    "lmk",          # let me know
    "np",           # no problem
    "gm",           # good-morning
    "yikes",
    "let's go",
    "gonna be",
    "haha",
    "lol",
    "shoot you a message",
    "will get you added",
    "got you",
    "yessir",
    "saw you",
    "my bad",
    "enjoy",
]


def inject_style_token(text: str) -> str:
    """Return a new sentence with a Luke-style token injected.
    If text already contains any style token (case-insensitive) it is returned unchanged."""
    low = text.lower()
    if any(tok in low for tok in STYLE_TOKENS):
        return text  # already has slang

    import hashlib
    token = STYLE_TOKENS[int(hashlib.sha256(text.encode()).hexdigest(), 16) % len(STYLE_TOKENS)]

    # Capitalise token if original sentence starts with uppercase
    token_cap = token.capitalize() if text and text[0].isupper() else token

    # If greeting at start, insert after greeting word
    greeting_match = re.match(r"^(hey|hi|hello|yo)([,!\s]+)(.*)$", text, re.I)
    if greeting_match:
        greeting, sep, rest = greeting_match.groups()
        return f"{greeting}{sep}{token}, {rest.strip()}"

    # default: prepend token + comma
    return f"{token_cap}, {text}"

def classify_stage(text:str, current_stage:str) -> str:
    low = text.lower()
    words = set(low.split())
    if current_stage == 'greeting':
        # first Luke after greeting is rapport
        return 'rapport'
    # Detect question prompts from Luke.
    if words & Q1_KW:
        return 'Q1'
    if words & Q2_KW:
        return 'Q2'
    if words & Q3_KW:
        return 'Q3'
    if words & Q4_KW:
        return 'Q4'
    if words & BOOKING_KW:
        return 'qualified'
    # otherwise keep current stage
    return current_stage



def build_examples() -> List[Dict]:
    examples: List[Dict] = []
    for root, _, files in os.walk(BASE_DIR):
        for fname in files:
            if not fname.startswith('message_') or not fname.endswith('.json'):
                continue
            path = pathlib.Path(root)/fname
            try:
                convo = json.load(open(path,'r',encoding='utf-8'))
            except Exception:
                continue
            messages = convo.get('messages', [])
            stage = 'greeting'
            for i in range(len(messages)-1):
                u = messages[i]
                a = messages[i+1]
                if u.get('sender_name') == 'Luke Davis':
                    continue
                if a.get('sender_name') != 'Luke Davis':
                    continue
                if 'content' not in u or 'content' not in a:
                    continue
                user_text = clean(u['content'])
                assist_text = clean(a['content'])
                if not user_text or not assist_text:
                    continue
                stage = classify_stage(assist_text, stage)
                stage_label = STAGE_IDS.get(stage, 'nurture')
                record = {
                    'messages':[ 
                        { 'role':'system', 'content':'You are Luke Davis, responding in your own conversational style.'},
                        { 'role':'tool',   'name':'stage', 'content': stage_label },
                        { 'role':'user',   'content': user_text},
                        { 'role':'assistant', 'content': assist_text}
                    ]
                }
                examples.append(record)
                # After qualified, reset to finished to stop further tag propagation
                if stage == 'qualified':
                    stage = 'nurture'
    return examples

def augment_with_style_tokens(examples: List[Dict]):
    """Duplicate examples with style tokens injected into Luke's response when absent."""
    augmented: List[Dict] = []
    for rec in examples:
        new_rec = json.loads(json.dumps(rec))  # deep copy
        assistant_msg = new_rec['messages'][-1]
        original = assistant_msg['content']
        injected = inject_style_token(original)
        if injected != original:
            assistant_msg['content'] = injected
            augmented.append(new_rec)
    examples.extend(augmented)

def main():
    data = build_examples()
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        for rec in data:
            f.write(json.dumps(rec, ensure_ascii=False)+'\n')
    print(f'Wrote {len(data)} examples to {OUTPUT}')

if __name__ == '__main__':
    main() 