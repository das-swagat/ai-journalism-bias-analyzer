# AI Journalism Bias Analyzer

A small school-project-grade web demo for analyzing article text and news URLs for:
- sentiment
- bias/context flags
- likely speakers/subjects
- emotion mix
- quick summary

This repo keeps the notebook as the research backbone and provides a small Flask web app for presentation.

## Project structure

- `notebooks/` — research notebooks
- `app/` — Flask backend + HTML frontend
- `data/` — optional `labeled_dataset.xlsx` for MBIC-informed cue expansion
- `reports/` — testing notes and observations

## Run locally

```bash
pip install -r requirements.txt
python app/app.py
```

Then open the local address shown in the terminal.

## Optional dataset

If you have the MBIC spreadsheet used earlier in the project, place it here exactly:

```text
data/labeled_dataset.xlsx
```

The app will still work without it; it will simply use the built-in cue lists only.

## Notes

- Confidence is a heuristic confidence estimate, not measured accuracy.
- URL scraping works best on standard public news pages and may miss some sites with dynamic or protected content.
- This is a project demo, not a production system.
