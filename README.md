# AI Journalism Bias Analyzer

An interactive article-analysis system for examining journalism text through:
- sentiment analysis
- bias and context-aware rule detection
- likely speaker and subject extraction
- emotion mix estimation
- structured article summarization

This repository preserves the notebook-based research workflow while providing a reusable Python backend and a lightweight Flask web interface for demonstration and testing.

---

## Overview

The system is designed to analyze either:
- pasted article text, or
- a public article URL

It then produces a structured report including:
- source type and likely outlet/platform
- sentence-level sentiment labels
- bias/context flags
- likely speakers and quoted content
- estimated emotion intensity and emotion mix
- article-level interpretation and quick summary

The project combines:
- sentiment scoring
- rule-based bias detection
- context-aware adjustments
- optional MBIC-informed cue expansion

---

## Repository Structure

ai_journalism_bias_analyzer/
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
└── README.md
