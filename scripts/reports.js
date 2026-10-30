function setJobReportStatus(message, isError = false) {
  const element = document.getElementById("jobReportStatus");
  element.innerText = message;
  element.classList.toggle("text-red-600", isError);
  element.classList.toggle("text-gray-600", !isError);
}

function showJobReportForm() {
  if (!selectedJob) return;
  document.getElementById("jobReportForm").classList.remove("hidden");
  document.getElementById("jobReportButton").classList.add("hidden");
  const siteKey = document.querySelector('meta[name="cloudflare-turnstile-sitekey"]').content.trim();
  if (!siteKey || !window.turnstile) {
    setJobReportStatus("CAPTCHAを読み込めません。ページを再読み込みしてもう一度お試しください。", true);
    return;
  }
  if (reportTurnstileWidgetId !== null) return;

  reportTurnstileWidgetId = window.turnstile.render("#jobReportTurnstile", {
    sitekey: siteKey,
    action: "job_report",
    callback: token => {
      reportTurnstileToken = token;
      document.getElementById("jobReportSubmitButton").disabled = false;
      setJobReportStatus("CAPTCHA確認が完了しました。");
    },
    "expired-callback": () => {
      reportTurnstileToken = null;
      document.getElementById("jobReportSubmitButton").disabled = true;
      setJobReportStatus("確認の有効期限が切れました。もう一度確認してください。", true);
    },
    "error-callback": errorCode => {
      reportTurnstileToken = null;
      document.getElementById("jobReportSubmitButton").disabled = true;
      setJobReportStatus(`CAPTCHA確認に失敗しました（${errorCode}）。もう一度お試しください。`, true);
      return true;
    }
  });
  setJobReportStatus("CAPTCHAを確認してから通報を送信してください。");
}

async function submitJobReport(event) {
  event.preventDefault();
  if (!selectedJob) return;
  const reason = document.getElementById("jobReportReason").value;
  const details = document.getElementById("jobReportDetails").value.trim();
  if (!reason) {
    setJobReportStatus("通報理由を選択してください。", true);
    return;
  }
  if (details.length > 500) {
    setJobReportStatus("詳細は500文字以内で入力してください。", true);
    return;
  }
  if (!reportTurnstileToken) {
    setJobReportStatus("送信前にCAPTCHA確認を完了してください。", true);
    return;
  }

  const submitButton = document.getElementById("jobReportSubmitButton");
  submitButton.disabled = true;
  setJobReportStatus("通報を送信しています。");
  try {
    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: String(selectedJob.id),
        reason,
        details,
        captchaToken: reportTurnstileToken
      })
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `通報の送信に失敗しました（${response.status}）。`);
    }

    document.getElementById("jobReportForm").classList.add("hidden");
    document.getElementById("jobReportSuccess").classList.remove("hidden");
  } catch (error) {
    setJobReportStatus(`通報を送信できませんでした: ${error.message}`, true);
    if (window.turnstile && reportTurnstileWidgetId !== null) {
      window.turnstile.reset(reportTurnstileWidgetId);
    }
  } finally {
    reportTurnstileToken = null;
  }
}

function clearJobReportWidget() {
  if (window.turnstile && reportTurnstileWidgetId !== null) {
    window.turnstile.remove(reportTurnstileWidgetId);
  }
  reportTurnstileToken = null;
  reportTurnstileWidgetId = null;
  document.getElementById("jobReportTurnstile").replaceChildren();
}
