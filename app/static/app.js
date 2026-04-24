let sentimentChart = null;
let biasChart = null;
let emotionChart = null;

function destroyCharts() {
  [sentimentChart, biasChart, emotionChart].forEach((chart) => {
    if (chart) chart.destroy();
  });
}

function valueOrNA(value) {
  if (value === undefined || value === null || value === "") {
    return "Not available";
  }
  return value;
}

function renderSummary(summary, mbicStatus) {
  return `
    <h2>Report Summary</h2>
    <div class="grid">
      <div><b>Source Type</b><br>${valueOrNA(summary.source_type)}</div>
      <div><b>Likely Outlet / Platform</b><br>${valueOrNA(summary.source_name)}</div>
      <div><b>Detected Title</b><br>${valueOrNA(summary.title)}</div>
      <div><b>Main Subject(s)</b><br>${valueOrNA(summary.top_subjects)}</div>
      <div><b>Total Sentences</b><br>${valueOrNA(summary.total_sentences)}</div>
      <div><b>Overall Interpretation</b><br>${valueOrNA(summary.overall_article_interpretation)}</div>
      <div><b>Average Emotion Intensity</b><br>${valueOrNA(summary["average_emotion_intensity_%"])}%</div>
      <div><b>Average Analysis Confidence</b><br>${valueOrNA(summary["average_analysis_confidence_%"])}%</div>
    </div>
    <p><b>Quick Summary:</b> ${valueOrNA(summary.quick_summary)}</p>
    <p><b>MBIC Status:</b> ${valueOrNA(mbicStatus)}</p>
  `;
}

function renderCards(targetId, items, formatter) {
  const root = document.getElementById(targetId);

  if (!items || items.length === 0) {
    root.innerHTML = "<p>No items to show.</p>";
    return;
  }

  root.innerHTML = items.map(formatter).join("");
}

function drawBarChart(canvasId, title, dataObject) {
  const ctx = document.getElementById(canvasId).getContext("2d");

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(dataObject || {}),
      datasets: [
        {
          label: title,
          data: Object.values(dataObject || {})
        }
      ]
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

function drawPieChart(canvasId, title, dataObject) {
  const ctx = document.getElementById(canvasId).getContext("2d");

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(dataObject || {}),
      datasets: [
        {
          data: Object.values(dataObject || {})
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: title }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");

  analyzeBtn.addEventListener("click", async () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const articleText = document.getElementById("articleText").value;
    const articleUrl = document.getElementById("articleUrl").value;
    const status = document.getElementById("status");
    const results = document.getElementById("results");

    status.textContent = "Analyzing...";
    results.classList.add("hidden");

    let payload;

    if (mode === "url") {
      if (!articleUrl.trim()) {
        status.textContent = "Please paste a URL first.";
        return;
      }
    
      payload = {
        article_text: "",
        article_url: articleUrl.trim()
      };
    } else {
      if (!articleText.trim()) {
        status.textContent = "Please paste article text first.";
        return;
      }
    
      payload = {
        article_text: articleText.trim(),
        article_url: ""
      };
    }

    try {
      const response = await fetch("/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!data.ok) {
        status.textContent = data.error || "Analysis failed.";
        return;
      }

      document.getElementById("summaryCard").innerHTML =
        renderSummary(data.summary, data.mbic_status);

      renderCards("speakers", data.speakers || [], (row) => `
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

      renderCards("flagged", data.flagged_sentences || [], (row) => `
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

      renderCards("negative", data.top_negative_sentences || [], (row) => `
        <div class="result-card">
          <p>${row.sentence}</p>
          <p><b>VADER:</b> ${row.vader_compound} |
          <b>Bias/Context:</b> ${row.bias_label} / ${row.context_adjusted_label} |
          <b>Severity:</b> ${row.severity_score}</p>
        </div>
      `);

      destroyCharts();

      sentimentChart = drawBarChart(
        "sentimentChart",
        "Sentiment Distribution",
        data.sentiment_counts
      );

      biasChart = drawBarChart(
        "biasChart",
        "Bias / Context Labels",
        data.bias_counts
      );

      emotionChart = drawPieChart(
        "emotionChart",
        "Emotion Mix %",
        data.emotion_mix
      );

      results.classList.remove("hidden");
      status.textContent = "Analysis complete.";
    } catch (error) {
      status.textContent = "Request failed: " + error;
    }
  });
});
