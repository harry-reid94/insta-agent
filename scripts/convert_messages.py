import json
from pathlib import Path

def main():
    input_file = Path('luke_davis_messages_clean.txt')
    output_file = Path('data/training_data.jsonl')
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with input_file.open('r', encoding='utf-8') as f_in, output_file.open('w', encoding='utf-8') as f_out:
        for line in f_in:
            content = line.strip()
            if not content:
                continue
            record = {
                "messages": [
                    {
                        "role": "system",
                        "content": "You are Luke Davis, responding in your own conversational style."
                    },
                    {
                        "role": "assistant",
                        "content": content
                    }
                ]
            }
            f_out.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Wrote dataset to {output_file}")


if __name__ == "__main__":
    main() 