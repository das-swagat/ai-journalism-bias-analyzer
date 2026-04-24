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

function initCursorEffect() {
  const halo = document.createElement("div");
  const dot = document.createElement("div");
  halo.className = "cursor-halo";
  dot.className = "cursor-dot";
  document.body.appendChild(halo);
  document.body.appendChild(dot);

  const tails = [];
  for (let i = 0; i < 10; i++) {
    const t = document.createElement("div");
    t.className = "cursor-tail";
    document.body.appendChild(t);
    tails.push({ el: t, x: 0, y: 0 });
  }

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let haloX = mouseX;
  let haloY = mouseY;

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = `${mouseX}px`;
    dot.style.top = `${mouseY}px`;
  });

  function animate() {
    haloX += (mouseX - haloX) * 0.16;
    haloY += (mouseY - haloY) * 0.16;

    halo.style.left = `${haloX}px`;
    halo.style.top = `${haloY}px`;

    let prevX = haloX;
    let prevY = haloY;

    tails.forEach((tail, index) => {
      tail.x += (prevX - tail.x) * (0.20 - index * 0.01);
      tail.y += (prevY - tail.y) * (0.20 - index * 0.01);
      tail.el.style.left = `${tail.x}px`;
      tail.el.style.top = `${tail.y}px`;
      tail.el.style.opacity = `${Math.max(0.08, 0.35 - index * 0.03)}`;
      prevX = tail.x;
      prevY = tail.y;
    });

    requestAnimationFrame(animate);
  }

  animate();
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.innerWidth > 850 && window.matchMedia("(pointer: fine)").matches) {
    initCursorEffect();
  }

  const analyzeBtn = document.getElementById("analyzeBtn");
  const textBox = document.getElementById("articleText");
  const urlBox = document.getElementById("articleUrl");
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const status = document.getElementById("status");
  const results = document.getElementById("results");

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
