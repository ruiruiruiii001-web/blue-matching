async function blockUser(blockedId) {
      if (!currentUser) return;
      if (blockedId === currentUser.id) return;
      if (!confirm("このユーザーをブロックしますか？\nブロックすると、このユーザーの求人やプロフィールが表示されなくなります。")) return;

      const { error } = await supabaseClient
        .from("user_blocks")
        .insert({ blocker_id: currentUser.id, blocked_id: blockedId });

      if (error) {
        alert("ブロックに失敗しました: " + error.message);
        return;
      }

      blockedUserIds.push(blockedId);
      renderJobList();
      renderEmployerDashboard();
      alert("ユーザーをブロックしました。");
    }

    async function unblockUser(blockedId) {
      if (!currentUser) return;
      const { error } = await supabaseClient
        .from("user_blocks")
        .delete()
        .eq("blocker_id", currentUser.id)
        .eq("blocked_id", blockedId);

      if (error) {
        alert("ブロック解除に失敗しました: " + error.message);
        return;
      }

      blockedUserIds = blockedUserIds.filter(id => id !== blockedId);
      renderJobList();
      renderEmployerDashboard();
    }

    function openReviewModal(applicationId, revieweeId, targetType, existingId = null, existingRating = 5, existingComment = "") {
      reviewContext = { applicationId, revieweeId, targetType, existingId };
      document.getElementById("reviewModal").classList.remove("hidden");
      document.getElementById("reviewTargetIcon").innerText = targetType === 'seeker' ? '👷' : '🏢';
      document.getElementById("reviewTitle").innerText = existingId ? '評価を修正' : (targetType === 'seeker' ? '職人を評価' : '企業を評価');
      document.getElementById("reviewComment").value = existingComment;
      document.getElementById("reviewSubmitButton").innerText = existingId ? '🔄 評価を更新する' : '🚀 評価を送信する';
      updateStars(existingRating);
    }


function closeReviewModal() {
  document.getElementById("reviewModal").classList.add("hidden");
  document.getElementById("reviewStatus").classList.add("hidden");
  reviewContext = null;
}

function updateStars(rating) {
  document.getElementById("reviewRating").value = rating;
  const container = document.getElementById("starContainer");
  container.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `text-4xl transition-transform hover:scale-110 focus:outline-none ${i <= rating ? "" : "grayscale opacity-30"}`;
    btn.innerText = "⭐";
    btn.onclick = () => updateStars(i);
    container.appendChild(btn);
  }
}

    async function submitReview(event) {
  event.preventDefault();
  if (!currentUser || !reviewContext) return;

  const rating = parseInt(document.getElementById("reviewRating").value);
  const comment = document.getElementById("reviewComment").value.trim();
  const status = document.getElementById("reviewStatus");
  const submitBtn = document.getElementById("reviewSubmitButton");

  status.innerText = "送信中...";
  status.className = "text-center text-xs font-bold py-2 text-blue-600";
  status.classList.remove("hidden");
  submitBtn.disabled = true;

  let result;
  if (reviewContext.existingId) {
    // 更新
    result = await supabaseClient
      .from("job_reviews")
      .update({ rating, comment })
      .eq("id", reviewContext.existingId);
  } else {
    // 新規挿入
    result = await supabaseClient
      .from("job_reviews")
      .insert({
        application_id: reviewContext.applicationId,
        reviewer_id: currentUser.id,
        reviewee_id: reviewContext.revieweeId,
        target_type: reviewContext.targetType,
        rating,
        comment
      });
  }

  if (result.error) {
    status.innerText = result.error.code === "23505" ? "すでに評価済みです。" : `エラー: ${result.error.message}`;
    status.className = "text-center text-xs font-bold py-2 text-red-600";
    submitBtn.disabled = false;
    return;
  }


  status.innerText = "評価を送信しました！";
  status.className = "text-center text-xs font-bold py-2 text-green-600";

  confetti({
    particleCount: 50,
    spread: 30,
    origin: { y: 0.7 }
  });

  setTimeout(() => {
    closeReviewModal();
    submitBtn.disabled = false;
  }, 1500);
}
async function fetchAvgRatings() {
      const { data, error } = await supabaseClient
        .from("job_reviews")
        .select("reviewee_id, rating");

      if (error) return;

      const scores = {};
      data.forEach(r => {
        if (!scores[r.reviewee_id]) scores[r.reviewee_id] = { sum: 0, count: 0 };
        scores[r.reviewee_id].sum += r.rating;
        scores[r.reviewee_id].count += 1;
      });

      Object.keys(scores).forEach(id => {
        avgRatings[id] = {
          avg: (scores[id].sum / scores[id].count).toFixed(1),
          count: scores[id].count
        };
      });
    }

    function renderRatingBadge(userId) {
      const rating = avgRatings[userId];
      if (!rating) return '';
      return `
        <div class="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 shadow-sm">
          <span class="text-amber-500 text-[10px]">⭐</span>
          <span class="text-amber-700 font-black text-[10px] leading-none">${rating.avg}</span>
          <span class="text-gray-400 text-[8px] font-bold">(${rating.count})</span>
        </div>
      `;
    }
