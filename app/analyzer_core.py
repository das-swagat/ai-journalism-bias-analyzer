import re
import math
from pathlib import Path
from collections import Counter
import urllib.parse

import pandas as pd
import requests
from bs4 import BeautifulSoup
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

vader = SentimentIntensityAnalyzer()

IMPLICIT_NEGATIVE_CUES = {
    "declined to comment", "no plan was offered", "was not addressed", "remains unclear",
    "failed to", "did not explain", "has yet to", "warned that", "concerns remain",
    "under pressure", "critics say", "questions remain", "without explanation",
    "did not respond", "doubts about", "must be revealed", "can only be revealed",
    "accused", "criticized", "wiped out opposition", "in exile or dead", "must resign",
    "not a legitimate president"
}

EXPLICIT_NEGATIVE_CUES = {
    "disgrace", "failure", "shameful", "hypocritical", "catastrophe", "collapse",
    "threat", "crisis", "war criminal", "thief", "dead-end war", "enormous damage",
    "lost his mind", "insane", "morbid craving"
}

POSITIVE_CUES = {
    "welcomed", "successful", "praised", "progress", "improved", "encouraging",
    "beneficial", "victory", "support"
}

SARCASM_MARKERS = {
    "oh great", "yeah,", "yeah ", "sure,", "sure ", "as if", "exactly what we needed",
    "i'm impressed", "i am impressed", "brilliant decision", "fantastic job",
    "amazing leadership", "what a great"
}

STOP_SUBJECTS = {
    "United States", "New York", "White House", "Google Colab", "Media Bias",
    "Bias Annotation", "TextBlob", "NBC News"
}

SOURCE_MAP = {
    "reuters.com": ("news_website", "Reuters"),
    "apnews.com": ("news_website", "Associated Press"),
    "bbc.com": ("news_website", "BBC"),
    "cnn.com": ("news_website", "CNN"),
    "nbcnews.com": ("news_website", "NBC News"),
    "nytimes.com": ("news_website", "New York Times"),
    "theguardian.com": ("news_website", "The Guardian"),
    "washingtonpost.com": ("news_website", "The Washington Post"),
    "foxnews.com": ("news_website", "Fox News"),
    "x.com": ("social_media", "X / Twitter"),
    "twitter.com": ("social_media", "X / Twitter"),
    "facebook.com": ("social_media", "Facebook"),
    "reddit.com": ("social_media", "Reddit"),
    "instagram.com": ("social_media", "Instagram"),
    "youtube.com": ("social_media", "YouTube"),
    "tiktok.com": ("social_media", "TikTok")
}

SPEAKER_PATTERNS = [
    re.compile(r'\b([A-Z][A-Za-z.\-]+(?:\s+[A-Z][A-Za-z.\-]+){0,2})\s+(said|wrote|added|told|argued|warned|criticized|accused|responded|called|urged|noted|discussed)\b'),
    re.compile(r'\b(?:according to|said|wrote|added|told|argued|warned|criticized|accused|responded|called|urged|noted)\s+([A-Z][A-Za-z.\-]+(?:\s+[A-Z][A-Za-z.\-]+){0,2})\b')
]


def maybe_extend_cues_from_mbic():
    global IMPLICIT_NEGATIVE_CUES, EXPLICIT_NEGATIVE_CUES, POSITIVE_CUES
    file = Path(__file__).resolve().parents[1] / 'data' / 'labeled_dataset.xlsx'
    if not file.exists():
        return 'No MBIC file found. Using built-in cue lists only.'
    try:
        df = pd.read_excel(file)
        required = {'sentence', 'Label_bias', 'biased_words4'}
        if not required.issubset(df.columns):
            return 'MBIC file found but expected columns are missing.'

        biased_df = df[df['Label_bias'].astype(str).str.lower() == 'biased'].copy()
        phrases = []
        for value in biased_df['biased_words4'].dropna().astype(str):
            for p in re.split(r'[;,|/]', value):
                p = p.strip().lower()
                if len(p) >= 4 and p != 'nan':
                    phrases.append(p)

        for p, _ in Counter(phrases).most_common(40):
            if any(w in p for w in ['not', 'without', 'concern', 'doubt', 'critic', 'accus', 'respond', 'unclear', 'remain', 'failed']):
                IMPLICIT_NEGATIVE_CUES.add(p)
            else:
                EXPLICIT_NEGATIVE_CUES.add(p)
        return 'Loaded MBIC-informed cues from data/labeled_dataset.xlsx.'
    except Exception as e:
        return f'MBIC file found but could not be used: {e}'

MBIC_STATUS = maybe_extend_cues_from_mbic()


def classify_source(domain: str):
    domain = domain.lower().replace('www.', '')
    if not domain:
        return 'pasted_text', 'Pasted Article Text'
    for key, value in SOURCE_MAP.items():
        if domain.endswith(key):
            return value
    return 'website', domain


def is_junk_paragraph(p: str):
    p_low = p.lower().strip()
    junk_patterns = [
        'sign up for', 'get this delivered', 'got a confidential news tip', 'we want to hear from you',
        'all rights reserved', 'data is a real-time snapshot', 'stock quotes', 'market data',
        'a versant media company', 'follow us on x', 'newsletter', 'advertisement',
        'global business and financial news'
    ]
    if len(p.split()) <= 3:
        return True
    return any(j in p_low for j in junk_patterns)


def get_article_text_and_meta(article_text: str, article_url: str):
    meta = {
        'title': '', 'domain': '', 'source_type': 'pasted_text', 'source_name': 'Pasted Article Text', 'scrape_status': 'pasted_text'
    }
    if isinstance(article_text, str) and article_text.strip():
        return article_text.strip(), meta

    if isinstance(article_url, str) and article_url.strip():
        parsed = urllib.parse.urlparse(article_url.strip())
        domain = parsed.netloc
        source_type, source_name = classify_source(domain)
        meta['domain'] = domain
        meta['source_type'] = source_type
        meta['source_name'] = source_name

        headers = {'User-Agent': 'Mozilla/5.0'}
        try:
            response = requests.get(article_url.strip(), headers=headers, timeout=20)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')

            title_tag = soup.find('title')
            if title_tag:
                meta['title'] = title_tag.get_text(' ', strip=True)

            article_blocks = soup.find_all(['article'])
            paragraphs = []
            if article_blocks:
                for block in article_blocks:
                    paragraphs.extend([p.get_text(' ', strip=True) for p in block.find_all('p')])
            if not paragraphs:
                paragraphs = [p.get_text(' ', strip=True) for p in soup.find_all('p')]

            cleaned = []
            for p in paragraphs:
                p = re.sub(r'\s+', ' ', p).strip()
                if len(p) >= 40 and not is_junk_paragraph(p):
                    cleaned.append(p)

            article = '\n'.join(cleaned).strip()
            meta['scrape_status'] = 'success' if article else 'no_text_extracted'
            return article, meta
        except Exception as e:
            meta['scrape_status'] = f'scrape_error: {e}'
            return '', meta

    return '', meta


def split_sentences_clean(text: str):
    text = text.replace('\r', '\n').replace('“', '"').replace('”', '"').replace('’', "'").strip()
    protected = {
        'U.S.': 'US_PROTECT', 'U.K.': 'UK_PROTECT', 'J.F.K.': 'JFK_PROTECT', 'Mr.': 'MR_PROTECT',
        'Mrs.': 'MRS_PROTECT', 'Dr.': 'DR_PROTECT', 'Prof.': 'PROF_PROTECT', 'No.': 'NO_PROTECT', 'St.': 'ST_PROTECT'
    }
    for k, v in protected.items():
        text = text.replace(k, v)
    text = re.sub(r'\b([A-Z])\.', r'\1_INITIALPROTECT', text)
    text = re.sub(r'\s+', ' ', text)

    chunks = re.split(r'[.!?]+["\']?\s+(?=[A-Z])', text)
    chunks = [c.strip() for c in chunks if c.strip()]

    restored = []
    for c in chunks:
        for k, v in protected.items():
            c = c.replace(v, k)
        c = c.replace('_INITIALPROTECT', '.')
        restored.append(c)

    merged = []
    i = 0
    while i < len(restored):
        cur = restored[i]
        if i + 1 < len(restored):
            tail_word = cur.split()[-1].lower() if cur.split() else ''
            if len(cur.split()) <= 3 or tail_word in {'the', 'a', 'an', 'of', 'to', 'on', 'in', 'with', 'and', 'including', 'saying'}:
                merged.append((cur + ' ' + restored[i + 1]).strip())
                i += 2
                continue
        merged.append(cur)
        i += 1

    final = []
    for s in merged:
        if not s.strip():
            continue
        if final and len(s.split()) <= 1:
            final[-1] += ' ' + s
        else:
            final.append(s)
    return final


def detect_quote_type(text: str):
    if any(q in text for q in ['"', '“', '”', '‘', '’']):
        return 'quote_or_quoted_content'
    return 'narration'


def extract_speaker(text: str):
    bad_speakers = {'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Monday', 'Saturday', 'Sunday', 'He', 'She', 'It', 'Among', 'Meanwhile'}
    for pattern in SPEAKER_PATTERNS:
        match = pattern.search(text)
        if match:
            candidate = match.group(1).strip()
            if candidate in bad_speakers or candidate in STOP_SUBJECTS:
                return ''
            parts = candidate.split()
            if parts and parts[0] in {'On', 'In', 'When', 'The'}:
                return ''
            if any(p in {'Business', 'Financial', 'News', 'Company', 'Analysis'} for p in parts):
                return ''
            return candidate
    return ''


def extract_subjects(full_text: str, topn: int = 5):
    matches = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b', full_text)
    bad_single = {'On', 'In', 'When', 'The', 'A', 'An', 'He', 'She', 'It', 'Meanwhile', 'But', 'Among', 'Even', 'Tuesday', 'Thursday', 'Friday', 'Wednesday', 'Monday', 'Saturday', 'Sunday'}
    bad_starts = {'Why', 'What', 'How', 'That', 'This', 'These', 'Those'}
    bad_words_anywhere = {'Rights', 'Reserved', 'Business', 'Financial', 'Analysis', 'Information', 'Newsletter', 'Company', 'Media'}

    counts = {}
    for match in matches:
        parts = match.split()
        if match in STOP_SUBJECTS:
            continue
        if parts[0] in bad_single or parts[0] in bad_starts:
            continue
        if any(p in bad_words_anywhere for p in parts):
            continue
        if len(parts) == 1 and match not in {'Russia', 'Ukraine', 'Kremlin', 'Putin', 'Remeslo', 'Navalny', 'Telegram', 'Fontanka', 'Tass', 'Solovyov', 'Rubio', 'Trump', 'Iran', 'Israel', 'Hezbollah', 'Microsoft', 'Meta', 'Anthropic', 'OpenAI', 'Amazon', 'CNBC', 'Reuters', 'CNN'}:
            continue
        counts[match] = counts.get(match, 0) + 1
    return sorted(counts, key=counts.get, reverse=True)[:topn]


def sentiment_label(tb_polarity: float, vd_compound: float):
    if vd_compound <= -0.1 or tb_polarity <= -0.1:
        return 'negative'
    if vd_compound >= 0.1 or tb_polarity >= 0.1:
        return 'positive'
    return 'neutral'


def estimate_emotion_label(text, sent_label):
    text_lower = text.lower()
    if sent_label == 'positive':
        return 'positive'
    if sent_label in ['negative', 'context_negative']:
        if any(w in text_lower for w in ['anger', 'attack', 'blame', 'war', 'threat']):
            return 'anger'
        if any(w in text_lower for w in ['fear', 'risk', 'crisis', 'danger', 'uncertain']):
            return 'fear'
        if any(w in text_lower for w in ['loss', 'death', 'damage', 'decline']):
            return 'sadness'
        return 'negative'
    return 'neutral'


def analyze_sentence(text: str, prev_text: str = '', next_text: str = ''):
    tb = TextBlob(text).sentiment
    vd = vader.polarity_scores(text)
    context_window = ' '.join([prev_text, text, next_text]).strip()
    wtb = TextBlob(context_window).sentiment
    wvd = vader.polarity_scores(context_window)
    text_lower = text.lower()

    implicit_hits = [p for p in IMPLICIT_NEGATIVE_CUES if p in text_lower]
    explicit_hits = [p for p in EXPLICIT_NEGATIVE_CUES if p in text_lower]
    positive_hits = [p for p in POSITIVE_CUES if p in text_lower]
    sarcasm_hits = [p for p in SARCASM_MARKERS if p in text_lower]

    sarcasm_flag = bool(sarcasm_hits or (tb.polarity > 0.2 and vd['compound'] < -0.3))

    sent_label = sentiment_label(tb.polarity, vd['compound'])
    if explicit_hits or implicit_hits:
        sent_label = 'negative'

    context_adjusted_label = sent_label
    if sent_label == 'neutral' and (wvd['compound'] <= -0.15 or wtb.polarity <= -0.1 or implicit_hits or explicit_hits):
        context_adjusted_label = 'context_negative'

    bias_label = 'none'
    if explicit_hits:
        bias_label = 'explicit_negative'
    elif implicit_hits:
        bias_label = 'implicit_negative'
    elif context_adjusted_label == 'context_negative':
        bias_label = 'contextual_negative'
    if sarcasm_flag:
        bias_label = 'sarcasm' if bias_label == 'none' else f'{bias_label}+sarcasm'

    effective_for_emotion = context_adjusted_label if context_adjusted_label != 'context_negative' else 'negative'
    emotion_label = estimate_emotion_label(text, effective_for_emotion)

    emotion_intensity = round(min(100, max(abs(wvd['compound']), abs(wtb.polarity)) * 70 + max(tb.subjectivity, wtb.subjectivity) * 30), 1)

    confidence = 50 + abs(vd['compound']) * 15 + abs(wvd['compound']) * 10 + abs(tb.polarity) * 10 + len(implicit_hits) * 5 + len(explicit_hits) * 8 + (7 if sarcasm_flag else 0)
    if sent_label == 'neutral' and not explicit_hits and len(implicit_hits) <= 1 and abs(vd['compound']) < 0.2:
        confidence -= 8
    confidence = round(max(45, min(98, confidence)), 1)

    if len(text.split()) <= 3:
        bias_label = 'none'
        if sent_label == 'neutral':
            context_adjusted_label = 'neutral'

    matched = [f'implicit:{x}' for x in implicit_hits] + [f'explicit:{x}' for x in explicit_hits] + [f'positive:{x}' for x in positive_hits] + [f'sarcasm:{x}' for x in sarcasm_hits]

    return {
        'sentence': text,
        'speaker': extract_speaker(text),
        'subject_focus': ', '.join(extract_subjects(text, 2)),
        'quote_type': detect_quote_type(text),
        'textblob_polarity': round(tb.polarity, 3),
        'textblob_subjectivity': round(tb.subjectivity, 3),
        'vader_compound': round(vd['compound'], 3),
        'sentiment_label': sent_label,
        'context_adjusted_label': context_adjusted_label,
        'bias_label': bias_label,
        'emotion_label': emotion_label,
        'emotion_intensity_%': emotion_intensity,
        'analysis_confidence_%': confidence,
        'matched_cues': '; '.join(matched)
    }


def summarize_article(df: pd.DataFrame, source_name: str, source_type: str, title: str, top_subjects):
    total = len(df)
    count_positive = int((df['sentiment_label'] == 'positive').sum())
    count_negative = int((df['sentiment_label'] == 'negative').sum())
    count_neutral = int((df['sentiment_label'] == 'neutral').sum())
    count_context_negative = int((df['context_adjusted_label'] == 'context_negative').sum())
    count_bias_flagged = int((df['bias_label'] != 'none').sum())
    count_quotes = int((df['quote_type'] == 'quote_or_quoted_content').sum())

    avg_emotion = round(float(df['emotion_intensity_%'].mean()), 1) if total else 0.0
    avg_conf = round(float(df['analysis_confidence_%'].mean()), 1) if total else 0.0

    if count_bias_flagged >= max(2, math.ceil(total * 0.20)):
        overall = 'neutral tone with noticeable bias/framing signals'
    elif count_negative > max(count_positive, count_neutral):
        overall = 'mostly negative'
    elif count_positive > max(count_negative, count_neutral):
        overall = 'mostly positive'
    else:
        overall = 'mostly neutral'

    summary_lines = [f'Source: {source_name} ({source_type}).']
    if title:
        summary_lines.append(f'Headline/title detected: {title}.')
    if top_subjects:
        summary_lines.append(f'Main subject focus: {", ".join(top_subjects[:3])}.')
    summary_lines.append(f'The article appears {overall}, with {count_bias_flagged} bias-flagged sentences, {count_context_negative} context-adjusted negative sentences, and average emotion intensity of {avg_emotion}%.')

    return {
        'source_name': source_name,
        'source_type': source_type,
        'title': title,
        'top_subjects': ', '.join(top_subjects),
        'total_sentences': total,
        'positive_sentences': count_positive,
        'negative_sentences': count_negative,
        'neutral_sentences': count_neutral,
        'context_negative_sentences': count_context_negative,
        'bias_flagged_sentences': count_bias_flagged,
        'quote_or_quoted_sentences': count_quotes,
        'average_emotion_intensity_%': avg_emotion,
        'average_analysis_confidence_%': avg_conf,
        'overall_article_interpretation': overall,
        'quick_summary': ' '.join(summary_lines)
    }


def analyze_article(article_text: str = '', article_url: str = ''):
    article, meta = get_article_text_and_meta(article_text, article_url)
    if not article:
        return {'ok': False, 'error': f"Could not load article. scrape_status={meta.get('scrape_status', '')}"}

    sentences = split_sentences_clean(article)
    sentences = [s for s in sentences if not is_junk_paragraph(s)]
    if not sentences:
        return {'ok': False, 'error': 'No usable sentences found after cleaning.'}

    rows = []
    for i, sentence in enumerate(sentences):
        prev_sentence = sentences[i - 1] if i > 0 else ''
        next_sentence = sentences[i + 1] if i + 1 < len(sentences) else ''
        rows.append(analyze_sentence(sentence, prev_sentence, next_sentence))

    df = pd.DataFrame(rows)
    df['speaker'] = df['speaker'].replace('', pd.NA)
    for i in range(1, len(df)):
        if pd.isna(df.loc[i, 'speaker']) and df.loc[i, 'quote_type'] == 'quote_or_quoted_content':
            df.loc[i, 'speaker'] = df.loc[i - 1, 'speaker']
    df['speaker'] = df['speaker'].fillna('')

    def framing_score(row):
        if row['context_adjusted_label'] in ['negative', 'context_negative']:
            return -1
        elif row['sentiment_label'] == 'positive':
            return 1
        return 0

    df['framing_score'] = df.apply(framing_score, axis=1)
    df['rolling_framing'] = df['framing_score'].rolling(3, min_periods=1).mean()

    def severity_score(row):
        score = 0
        if row['bias_label'] == 'explicit_negative':
            score += 4
        elif row['bias_label'] == 'implicit_negative':
            score += 3
        elif row['bias_label'] == 'contextual_negative':
            score += 2
        elif 'sarcasm' in str(row['bias_label']):
            score += 3
        if row['sentiment_label'] == 'negative':
            score += 2
        if row['context_adjusted_label'] == 'context_negative':
            score += 1
        score += row['analysis_confidence_%'] / 100
        score += row['emotion_intensity_%'] / 200
        return round(score, 3)

    df['severity_score'] = df.apply(severity_score, axis=1)

    top_subjects = extract_subjects(article, 5)
    summary = summarize_article(df, meta['source_name'], meta['source_type'], meta['title'], top_subjects)

    flagged = df[df['bias_label'] != 'none'].sort_values(['severity_score', 'analysis_confidence_%', 'emotion_intensity_%'], ascending=False)
    top_negative = df.sort_values(['severity_score', 'vader_compound'], ascending=[False, True]).head(5)

    emotion_mix = (df['emotion_label'].value_counts(normalize=True) * 100).round(1).to_dict()
    sentiment_counts = df['sentiment_label'].value_counts().to_dict()
    bias_counts = df['bias_label'].value_counts().to_dict()
    quote_counts = df['quote_type'].value_counts().to_dict()

    speaker_rows = df[(df['speaker'] != '') | (df['quote_type'] == 'quote_or_quoted_content')].head(8)

    return {
        'ok': True,
        'mbic_status': MBIC_STATUS,
        'meta': meta,
        'summary': summary,
        'sentiment_counts': sentiment_counts,
        'bias_counts': bias_counts,
        'quote_counts': quote_counts,
        'emotion_mix': emotion_mix,
        'speakers': speaker_rows[['speaker', 'sentence', 'sentiment_label', 'bias_label', 'context_adjusted_label', 'emotion_intensity_%', 'analysis_confidence_%', 'matched_cues']].to_dict(orient='records'),
        'flagged_sentences': flagged[['sentence', 'bias_label', 'context_adjusted_label', 'emotion_intensity_%', 'analysis_confidence_%', 'matched_cues', 'severity_score']].head(10).to_dict(orient='records'),
        'top_negative_sentences': top_negative[['sentence', 'vader_compound', 'bias_label', 'context_adjusted_label', 'severity_score']].to_dict(orient='records'),
        'results': df.to_dict(orient='records')
    }
