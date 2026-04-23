let sentimentChart, biasChart, emotionChart;

function destroyCharts() {
  [sentimentChart, biasChart, emotionChart].forEach(ch => { if (ch) ch.destroy(); });
}

function renderKeyValue(summary) {
  return `
    <h2>Report Summary</h2>
    <div class="kv">
      <div><b>Source Type</b></div><div>${summary.source_type}</div>
      <div><b>Likely Outlet / Platform</b></div><div>${summary.source_name}</div>
      <div><b>Detected Title</b></div><div>${summary.title || 'Not detected'}</div>
      <div><b>Main Subject(s)</b></div><div>${summary.top_subjects || 'Not clearly detected'}</div>
      <div><b>Total Sentences</b></div><div>${summary.total_sentences}</div>
      <div><b>Overall Interpretation</b></div><div>${summary.overall_article_interpretation}</div>
      <div><b>Average Emotion Intensity</b></div><div>${summary.average_emotion_intensity_%}%</div>
      <div><b>Average Analysis Confidence</b></div><div>${summary.average_analysis_confidence_%}%</div>
      <div><b>Quick Summary</b></div><div>${summary.quick_summary}</div>
    </div>`;
}

function renderCards(targetId, items, formatter) {
  const root = document.getElementById(targetId);
  root.innerHTML = items.length ? items.map(formatter).join('') : '<div class="small">No items to show.</div>';
}

function drawBarChart(id, title, obj) {
  const ctx = document.getElementById(id).getContext('2d');
  return new Chart(ctx, {
    type: 'bar',
    data: { labels: Object.keys(obj), datasets: [{ label: title, data: Object.values(obj) }] },
    options: { responsive: true, plugins: { legend: { display:false }, title: { display:true, text:title } } }
  });
}

function drawPieChart(id, title, obj) {
  const ctx = document.getElementById(id).getContext('2d');
  return new Chart(ctx, {
    type: 'pie',
    data: { labels: Object.keys(obj), datasets: [{ data: Object.values(obj) }] },
    options: { responsive: true, plugins: { title: { display:true, text:title } } }
  });
}

document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const articleText = document.getElementById('articleText').value;
  const articleUrl = document.getElementById('articleUrl').value;
  const status = document.getElementById('status');
  const results = document.getElementById('results');

  status.textContent = 'Analyzing...';
  results.classList.add('hidden');

  const payload = mode === 'text' ? { article_text: articleText, article_url: '' } : { article_text: '', article_url: articleUrl };

  try {
    const resp = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();

    if (!data.ok) {
      status.textContent = data.error || 'Analysis failed.';
      return;
    }

    document.getElementById('summaryCard').innerHTML = renderKeyValue(data.summary) + `<p class="small">${data.mbic_status}</p>`;

    renderCards('speakers', data.speakers, row => `
      <div class="item">
        <div><span class="badge">${row.speaker || 'Unclear / quoted speaker'}</span></div>
        <div>${row.sentence}</div>
        <div class="small">Sentiment: ${row.sentiment_label} | Bias/Context: ${row.bias_label} / ${row.context_adjusted_label}</div>
        <div class="small">Emotion intensity: ${row['emotion_intensity_%']}% | Confidence: ${row['analysis_confidence_%']}%</div>
        <div class="small">Matched cues: ${row.matched_cues || 'None'}</div>
      </div>`);

    renderCards('flagged', data.flagged_sentences, row => `
      <div class="item">
        <div><span class="badge">${row.bias_label}</span> ${row.sentence}</div>
        <div class="small">Context-adjusted: ${row.context_adjusted_label} | Severity: ${row.severity_score}</div>
        <div class="small">Emotion intensity: ${row['emotion_intensity_%']}% | Confidence: ${row['analysis_confidence_%']}%</div>
        <div class="small">Matched cues: ${row.matched_cues || 'None'}</div>
      </div>`);

    renderCards('negative', data.top_negative_sentences, row => `
      <div class="item">
        <div>${row.sentence}</div>
        <div class="small">VADER: ${row.vader_compound} | Bias/Context: ${row.bias_label} / ${row.context_adjusted_label} | Severity: ${row.severity_score}</div>
      </div>`);

    destroyCharts();
    sentimentChart = drawBarChart('sentimentChart', 'Sentiment Distribution', data.sentiment_counts);
    biasChart = drawBarChart('biasChart', 'Bias / Context Labels', data.bias_counts);
    emotionChart = drawPieChart('emotionChart', 'Emotion Mix %', data.emotion_mix);

    results.classList.remove('hidden');
    status.textContent = 'Analysis complete.';
  } catch (err) {
    status.textContent = 'Request failed: ' + err;
  }
});
