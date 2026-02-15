#!/usr/bin/env python3
import json
import re
import urllib.request
from collections import defaultdict


SOURCES = [
    "https://raw.githubusercontent.com/iDvel/rime-ice/main/cn_dicts/base.dict.yaml",
    "https://raw.githubusercontent.com/iDvel/rime-ice/main/cn_dicts/ext.dict.yaml",
    "https://raw.githubusercontent.com/iDvel/rime-ice/main/cn_dicts/others.dict.yaml",
]

PHRASE_RE = re.compile(r"^[\u3400-\u9fff]{2,6}$")
PINYIN_RE = re.compile(r"^[a-zA-Z\s'\-:]+$")
TOPN_PER_KEY = 10
MAX_KEYS = 120000


def normalize_pinyin(raw):
    if not raw:
        return ""
    text = raw.lower().replace("u:", "v").replace("ü", "v")
    text = text.replace("'", " ").replace("-", " ")
    pieces = []
    for part in text.split():
        clean = re.sub(r"[^a-zv]", "", part)
        if clean:
            pieces.append(clean)
    if not pieces:
        return ""
    return "".join(pieces)


def parse_weight(parts):
    if len(parts) >= 3 and parts[2].strip().isdigit():
        return int(parts[2].strip())
    return 1


def iter_entries(url):
    with urllib.request.urlopen(url, timeout=120) as resp:
        for raw_line in resp.read().decode("utf-8", errors="ignore").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line in ("---", "..."):
                continue
            if "\t" not in line:
                continue

            parts = line.split("\t")
            if len(parts) < 2:
                continue

            phrase = parts[0].strip()
            pinyin = parts[1].strip()
            if not PHRASE_RE.match(phrase):
                continue
            if not PINYIN_RE.match(pinyin):
                continue

            key = normalize_pinyin(pinyin)
            if not key:
                continue

            weight = parse_weight(parts)
            yield key, phrase, weight


def main():
    key_phrase_weight = defaultdict(dict)
    key_score = defaultdict(int)

    for url in SOURCES:
        print(f"loading {url}")
        for key, phrase, weight in iter_entries(url):
            old = key_phrase_weight[key].get(phrase)
            if old is None or weight > old:
                key_phrase_weight[key][phrase] = weight
            if weight > key_score[key]:
                key_score[key] = weight

    selected_keys = sorted(
        key_phrase_weight.keys(),
        key=lambda k: (-key_score[k], len(k), k)
    )[:MAX_KEYS]

    phrase_dict = {}
    for key in selected_keys:
        phrase_map = key_phrase_weight[key]
        items = sorted(phrase_map.items(), key=lambda item: (-item[1], item[0]))[:TOPN_PER_KEY]
        phrase_dict[key] = [phrase for phrase, _ in items]

    with open("pinyin-phrase-dict.json", "w", encoding="utf-8") as f:
        json.dump(phrase_dict, f, ensure_ascii=False, separators=(",", ":"))

    print(f"done: keys={len(phrase_dict)}")


if __name__ == "__main__":
    main()
