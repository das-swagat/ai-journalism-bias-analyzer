from flask import Flask, render_template, request, jsonify
from analyzer_core import analyze_article

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    payload = request.get_json(force=True)
    article_text = payload.get('article_text', '') or ''
    article_url = payload.get('article_url', '') or ''
    result = analyze_article(article_text=article_text, article_url=article_url)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
