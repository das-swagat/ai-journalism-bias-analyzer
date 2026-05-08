let sentimentChart = null;
let biasChart = null;
let emotionChart = null;

function destroyCharts() {
  [sentimentChart, biasChart, emotionChart].forEach((chart) => {
    if (chart) chart.destroy();
  });
}

function escapeHtml(value) {
  if (value === undefined || value === null || value === "") {
    return "Not available";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function valueOrNA(value) {
  return escapeHtml(value);
}

function renderSummary(summary, mbicStatus) {
  return `
    <h2>Report Summary</h2>
    <div class="grid">
      <div><b>Source Type</b><br>${valueOrNA(summary.source_type)}</div>
      <div><b>Outlet / Platform</b><br>${valueOrNA(summary.source_name)}</div>
      <div><b>Detected Title</b><br>${valueOrNA(summary.title)}</div>
      <div><b>Main Subject(s)</b><br>${valueOrNA(summary.top_subjects)}</div>
      <div><b>Total Sentences</b><br>${valueOrNA(summary.total_sentences)}</div>
      <div><b>Overall Interpretation</b><br>${valueOrNA(summary.overall_article_interpretation)}</div>
      <div><b>Emotion Intensity</b><br>${valueOrNA(summary["average_emotion_intensity_%"])}%</div>
      <div><b>Analysis Confidence</b><br>${valueOrNA(summary["average_analysis_confidence_%"])}%</div>
    </div>
    <p><b>Quick Summary:</b> ${valueOrNA(summary.quick_summary)}</p>
    <p><b>MBIC Status:</b> ${valueOrNA(mbicStatus)}</p>
    
    <div class="guide-box">
      <h3>How to read this report</h3>
      <p>
        <b>VADER</b> stands for <b>Valence Aware Dictionary and sEntiment Reasoner</b>.
        It gives a compound sentiment score from <b>-1</b> to <b>+1</b>, where negative
        values suggest negative tone, positive values suggest positive tone, and values
        near 0 suggest neutral tone.
      </p>
      <p>
        Bias/context labels are rule-based analysis cues, not final judgments. Severity
        combines sentiment strength, cue strength, and context-based signals.
      </p>
    </div>
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

function chartColors(count) {
  const colors = [
    "#8b2f24",
    "#c39a3b",
    "#234d63",
    "#6e8b4e",
    "#9b6b32",
    "#5b4a3f"
  ];
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
}

function drawBarChart(canvasId, title, dataObject) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const labels = Object.keys(dataObject || {});
  const values = Object.values(dataObject || {});

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          backgroundColor: chartColors(values.length),
          borderColor: "#231f1a",
          borderWidth: 1,
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: title,
          color: "#231f1a",
          font: { family: "Georgia", size: 16, weight: "bold" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#4c4033", font: { family: "Georgia" } },
          grid: { color: "rgba(0,0,0,0.08)" }
        },
        y: {
          ticks: { color: "#4c4033", font: { family: "Georgia" } },
          grid: { color: "rgba(0,0,0,0.12)" }
        }
      }
    }
  });
}

function drawPieChart(canvasId, title, dataObject) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const labels = Object.keys(dataObject || {});
  const values = Object.values(dataObject || {});

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: chartColors(values.length),
          borderColor: "#fff8e8",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      cutout: "45%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#4c4033", font: { family: "Georgia" } }
        },
        title: {
          display: true,
          text: title,
          color: "#231f1a",
          font: { family: "Georgia", size: 16, weight: "bold" }
        }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const textBox = document.getElementById("articleText");
  const urlBox = document.getElementById("articleUrl");
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const status = document.getElementById("status");
  const results = document.getElementById("results");

  function looksLikeUrl(value) {
    const v = value.trim().toLowerCase();
    return (
      v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("www.")
    );
  }

  function looksLikeLongText(value) {
    const v = value.trim();
    return v.length > 80 && v.split(/\s+/).length > 12;
  }

  function updateInputMode() {
    const mode = document.querySelector('input[name="mode"]:checked').value;

    status.textContent = "";
    results.classList.add("hidden");

    if (mode === "url") {
      textBox.style.display = "none";
      urlBox.style.display = "block";
      textBox.value = "";
      urlBox.focus();
    } else {
      textBox.style.display = "block";
      urlBox.style.display = "none";
      urlBox.value = "";
      textBox.focus();
    }
  }

  modeRadios.forEach((radio) => {
    radio.addEventListener("change", updateInputMode);
  });

  updateInputMode();

  analyzeBtn.addEventListener("click", async () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const articleText = textBox.value;
    const articleUrl = urlBox.value;

    status.textContent = "Analyzing...";
    results.classList.add("hidden");

    let payload;

    if (mode === "url") {
      const cleanUrl = articleUrl.trim();

      if (!cleanUrl) {
        status.textContent = "Please paste a URL first.";
        return;
      }

      if (looksLikeLongText(cleanUrl) && !looksLikeUrl(cleanUrl)) {
        status.textContent =
          "This looks like article text. Please select Paste article text instead.";
        return;
      }

      if (!looksLikeUrl(cleanUrl)) {
        status.textContent =
          "Please enter a full article URL beginning with http:// or https://.";
        return;
      }

      payload = {
        article_text: "",
        article_url: cleanUrl.startsWith("www.")
          ? "https://" + cleanUrl
          : cleanUrl
      };
    } else {
      const cleanText = articleText.trim();

      if (!cleanText) {
        status.textContent = "Please paste article text first.";
        return;
      }

      if (looksLikeUrl(cleanText) && cleanText.split(/\s+/).length <= 3) {
        status.textContent =
          "This looks like a URL. Please select Use article URL instead.";
        return;
      }

      payload = {
        article_text: cleanText,
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
          <h4>${valueOrNA(row.speaker || "Unclear / quoted speaker")}</h4>
          <p>${valueOrNA(row.sentence)}</p>
          <p><b>Sentiment:</b> ${valueOrNA(row.sentiment_label)} |
          <b>Bias/Context:</b> ${valueOrNA(row.bias_label)} / ${valueOrNA(row.context_adjusted_label)}</p>
          <p><b>Emotion:</b> ${valueOrNA(row["emotion_intensity_%"])}% |
          <b>Confidence:</b> ${valueOrNA(row["analysis_confidence_%"])}%</p>
          <p><b>Matched cues:</b> ${valueOrNA(row.matched_cues || "None")}</p>
        </div>
      `);

      renderCards("flagged", data.flagged_sentences || [], (row) => `
        <div class="result-card">
          <h4>${valueOrNA(row.bias_label)}</h4>
          <p>${valueOrNA(row.sentence)}</p>
          <p><b>Context-adjusted:</b> ${valueOrNA(row.context_adjusted_label)} |
          <b>Severity:</b> ${valueOrNA(row.severity_score)}</p>
          <p><b>Emotion:</b> ${valueOrNA(row["emotion_intensity_%"])}% |
          <b>Confidence:</b> ${valueOrNA(row["analysis_confidence_%"])}%</p>
          <p><b>Matched cues:</b> ${valueOrNA(row.matched_cues || "None")}</p>
        </div>
      `);

      renderCards("negative", data.top_negative_sentences || [], (row) => `
        <div class="result-card">
          <p>${valueOrNA(row.sentence)}</p>
          <p><b>VADER:</b> ${valueOrNA(row.vader_compound)} |
          <b>Bias/Context:</b> ${valueOrNA(row.bias_label)} / ${valueOrNA(row.context_adjusted_label)} |
          <b>Severity:</b> ${valueOrNA(row.severity_score)}</p>
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
