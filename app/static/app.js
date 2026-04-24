let sentimentChart, biasChart, emotionChart;

function destroyCharts() {
  [sentimentChart, biasChart, emotionChart].forEach(ch => {
    if (ch) ch.destroy();
  });
}

function valueOrNA(v) {
  return v === undefined || v === null || v === "" ? "Not available" : v;
}

function renderSummary(summary, mbicStatus) {
  return `
    <h2>Report Summary</h2>
    <div class="grid">
      <div><b>Source Type:</b><br>${valueOrNA(summary.source_type)}</div>
      <div><b>Likely Outlet / Platform:</b><br>${valueOrNA(summary.source_name)}</div>
      <div><b>Detected Title:</b><br>${valueOrNA(summary.title)}</div>
      <div><b>Main Subject(s):</b><br>${valueOrNA(summary.top_subjects)}</div>
      <div><b>Total Sentences:</b><br>${valueOrNA(summary.total_sentences)}</div>
      <div><b>Overall Interpretation:</b><br>${valueOrNA(summary.overall_article_interpretation)}</div>
      <div><b>Average Emotion Intensity:</b><br>${valueOrNA(summary["average_emotion_intensity_%"])}%</div>
      <div><b>Average Analysis Confidence:</b><br>${valueOrNA(summary["average_analysis_confidence_%"])}%</div>
    </div>
    <p><b>Quick Summary:</b> ${valueOrNA(summary.quick_summary)}</p>
    <p><b>MBIC Status:</b> ${valueOrNA(mbicStatus)}</p>
  `;
}

function renderCards(targetId, items, formatter) {
  const root = document.getElementById(targetId);
  root.innerHTML = items && items.length
    ? items.map(formatter).join("")
    : "<p>No items to show.</p>";
}

function drawBarChart(id, title, obj) {
  const ctx = document.getElementById(id).getContext("2d");
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(obj || {}),
      datasets: [{ label: title, data: Object.values(obj || {}) }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: title }
      }
    }
  });
}

function drawPieChart(id, title, obj) {
  const ctx = document.getElementById(id).getContext("2d");
  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(obj || {}),
      datasets: [{ data: Object.values(obj || {}) }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: title }
      }
    }
  });
}

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const articleText = document.getElementById("articleText").value;
  const articleUrl = document.getElementById("articleUrl").value;
  const status = document.getElementById("status");
  const results = document.getElementById("results");

  status.textContent = "Analyzing...";
  results.classList.add("hidden");

  const payload = mode === "text"
    ? { article_text: articleText, article_url: "" }
    : { article_text: "", article_url: articleUrl };

  try {
    const resp = await fetch("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();

    if (!data.ok) {
      status.textContent = data.error || "Analysis failed.";
      return;
    }

    document.getElementById("summaryCard").innerHTML =
      renderSummary(data.summary, data.mbic_status);

    renderCards("speakers", data.speakers || [], row => `
      <div class="result-card">
        <h4>${row.speaker || "Unclear / quoted speaker"}</h4>
        <p>${row.sentence}</p>
        <p><b>Sentiment:</b> ${row.sentiment_label} |
        <b>Bias/Context:</b> ${row.bias_label} / ${row.context_adjusted_label}</p>
        <p><b>Emotion:</b> ${row["emotion_intensity_%"]}% |
        <b>Confidence:</b> ${row["analysis_confidence_%"]}%</p>
        <p><b>Matched cues:</b> ${row.matched_cues || "None"}</p>
      </div>
    `);

    renderCards("flagged", data.flagged_sentences || [], row => `
      <div class="result-card">
        <h4>${row.bias_label}</h4>
        <p>${row.sentence}</p>
        <p><b>Context-adjusted:</b> ${row.context_adjusted_label} |
        <b>Severity:</b> ${row.severity_score}</p>
        <p><b>Emotion:</b> ${row["emotion_intensity_%"]}% |
        <b>Confidence:</b> ${row["analysis_confidence_%"]}%</p>
        <p><b>Matched cues:</b> ${row.matched_cues || "None"}</p>
      </div>
    `);

    renderCards("negative", data.top_negative_sentences || [], row => `
      <div class="result-card">
        <p>${row.sentence}</p>
        <p><b>VADER:</b> ${row.vader_compound} |
        <b>Bias/Context:</b> ${row.bias_label} / ${row.context_adjusted_label} |
        <b>Severity:</b> ${row.severity_score}</p>
      </div>
    `);

    destroyCharts();
    sentimentChart = drawBarChart("sentimentChart", "Sentiment Distribution", data.sentiment_counts);
    biasChart = drawBarChart("biasChart", "Bias / Context Labels", data.bias_counts);
    emotionChart = drawPieChart("emotionChart", "Emotion Mix %", data.emotion_mix);

    results.classList.remove("hidden");
    status.textContent = "Analysis complete.";
  } catch (err) {
    status.textContent = "Request failed: " + err;
  }
});
