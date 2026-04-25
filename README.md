# The Context Observer  
### AI-powered journalism analysis

The Context Observer is an interactive journalism analysis tool that examines article text or public news URLs for sentiment, bias/context cues, likely speakers, subject focus, and estimated emotional tone.

Live demo:  
https://ai-journalism-bias-analyzer.onrender.com

---

## Use the Web App

The easiest way to use the tool is through the hosted web version:

1. Open the live demo link:  
   https://ai-journalism-bias-analyzer.onrender.com

2. Choose one input option:
   - **Paste article text**
   - **Use article URL**

3. Click **Analyze Article**

4. Review the generated report:
   - overall interpretation
   - sentiment distribution
   - bias/context labels
   - emotion mix
   - likely speakers
   - top bias-flagged sentences
   - top negative sentences

Note: Some news websites may block URL scraping. If URL mode fails, copy and paste the article text instead.

---

## Project Overview

This project combines a notebook-based research workflow with a Flask web application.

The analyzer uses:
- TextBlob sentiment scoring
- VADER sentiment scoring
- rule-based bias/context cue detection
- MBIC-informed cue expansion
- sentence-level analysis
- lightweight speaker and subject extraction
- visual summaries using charts

The goal is not to claim perfect bias detection, but to provide an explainable prototype for studying how sentiment, framing, context, and bias cues appear in journalism.

---

## Repository Structure

```text
ai-journalism-bias-analyzer/
├── app/
│   ├── app.py
│   ├── analyzer_core.py
│   ├── templates/
│   │   └── index.html
│   └── static/
│       ├── styles.css
│       └── app.js
├── data/
│   └── labeled_dataset.xlsx
├── notebooks/
│   └── article_bias_analyzer_v4_professional.ipynb
├── reports/
│   └── testing_notes.md
├── requirements.txt
├── runtime.txt
├── render.yaml
└── README.md
