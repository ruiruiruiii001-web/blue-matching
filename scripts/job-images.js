const MAX_JOB_IMAGES = 5;
const MAX_JOB_IMAGE_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_JOB_IMAGE_OUTPUT_BYTES = 1024 * 1024;
const MAX_JOB_IMAGE_DIMENSION = 1600;
const MAX_JOB_IMAGE_PIXELS = 40000000;

let retainedJobImageUrls = [];
let pendingJobImageFiles = [];
let jobImagePreviewObjectUrls = [];
let jobImagesSchemaReady = false;

function getJobImages(job) {
  const images = Array.isArray(job?.image_urls) && job.image_urls.length
    ? job.image_urls
    : job?.image_url
      ? [job.image_url]
      : [];
  return [...new Set(images.filter(url => typeof url === "string" && /^https?:\/\//i.test(url)))].slice(0, MAX_JOB_IMAGES);
}

function setJobImagesForEdit(job) {
  retainedJobImageUrls = getJobImages(job || {});
  pendingJobImageFiles = [];
  setJobImageStatus(jobImagesSchemaReady
    ? `${retainedJobImageUrls.length}枚登録済み。`
    : "写真の追加・削除を有効にするには、README記載の写真用SQLを実行してください。既存の写真は保持されます。");
  renderJobImagePreviews();
}

function resetJobImages() {
  retainedJobImageUrls = [];
  pendingJobImageFiles = [];
  renderJobImagePreviews();
  const input = document.getElementById("jobImageFiles");
  if (input) input.value = "";
  const status = document.getElementById("jobImageStatus");
  if (status) setJobImageStatus(jobImagesSchemaReady
    ? "写真は自動的に圧縮して保存されます。JPEG・PNG・WebP、1枚15MBまで。"
    : "写真用SQLを実行すると、最大5枚の登録が使えます。既存写真は引き続き表示されます。", !jobImagesSchemaReady);
}

function selectJobImages(input) {
  if (!jobImagesSchemaReady) {
    setJobImageStatus("複数枚写真を使うには、写真用SQLを実行してください。", true);
    input.value = "";
    return;
  }
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length) return;
  const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const invalidFile = files.find(file => !acceptedTypes.has(file.type) || file.size > MAX_JOB_IMAGE_INPUT_BYTES);
  if (invalidFile) {
    setJobImageStatus(
      `${invalidFile.name}: JPEG・PNG・WebP形式で、1枚15MB以下の画像を選んでください。`,
      true
    );
    return;
  }
  if (retainedJobImageUrls.length + pendingJobImageFiles.length + files.length > MAX_JOB_IMAGES) {
    setJobImageStatus(`写真は合計${MAX_JOB_IMAGES}枚までです。先に不要な写真を削除してください。`, true);
    return;
  }
  pendingJobImageFiles.push(...files);
  setJobImageStatus(`${retainedJobImageUrls.length + pendingJobImageFiles.length}枚選択中。保存時に圧縮してアップロードします。`);
  renderJobImagePreviews();
}

function setJobImageStatus(message, isError = false) {
  const status = document.getElementById("jobImageStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `mt-1 text-[10px] ${isError ? "text-red-700" : "text-gray-500"}`;
  const input = document.getElementById("jobImageFiles");
  const button = document.getElementById("jobImageSelectButton");
  if (input) input.disabled = !jobImagesSchemaReady;
  if (button) {
    button.disabled = !jobImagesSchemaReady;
    button.classList.toggle("cursor-not-allowed", !jobImagesSchemaReady);
    button.classList.toggle("opacity-50", !jobImagesSchemaReady);
  }
}

function removeJobImage(kind, index) {
  if (kind === "retained") retainedJobImageUrls.splice(index, 1);
  if (kind === "pending") pendingJobImageFiles.splice(index, 1);
  setJobImageStatus(`${retainedJobImageUrls.length + pendingJobImageFiles.length}枚選択中。`);
  renderJobImagePreviews();
}

function renderJobImagePreviews() {
  jobImagePreviewObjectUrls.forEach(url => URL.revokeObjectURL(url));
  jobImagePreviewObjectUrls = [];
  const container = document.getElementById("jobImagePreviews");
  if (!container) return;
  const previews = [
    ...retainedJobImageUrls.map((url, index) => ({
      src: url,
      kind: "retained",
      index,
      label: `登録済み写真 ${index + 1}`
    })),
    ...pendingJobImageFiles.map((file, index) => {
      const src = URL.createObjectURL(file);
      jobImagePreviewObjectUrls.push(src);
      return { src, kind: "pending", index, label: file.name };
    })
  ];
  container.innerHTML = previews.map(photo => `
    <figure class="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.label)}" class="aspect-[4/3] w-full object-cover">
      <button type="button" aria-label="${escapeHtml(photo.label)}を削除" onclick="removeJobImage('${photo.kind}', ${photo.index})" class="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-lg font-bold text-white hover:bg-black">×</button>
      <figcaption class="truncate px-2 py-1 text-[10px] text-gray-500">${escapeHtml(photo.label)}</figcaption>
    </figure>`).join("");
}

function createCompressedJobImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (image.naturalWidth * image.naturalHeight > MAX_JOB_IMAGE_PIXELS) {
        reject(new Error("画像の画素数が大きすぎます。別の画像をお試しください。"));
        return;
      }
      const scale = Math.min(1, MAX_JOB_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("画像を圧縮できませんでした。別の画像をお試しください。"));
        return;
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const tryQuality = quality => {
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error("画像をJPEGに変換できませんでした。"));
            return;
          }
          if (blob.size <= MAX_JOB_IMAGE_OUTPUT_BYTES) {
            resolve(blob);
          } else if (quality > 0.5) {
            tryQuality(quality - 0.1);
          } else {
            reject(new Error("圧縮後も画像が1MBを超えています。別の画像をお試しください。"));
          }
        }, "image/jpeg", quality);
      };
      tryQuality(0.85);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`${file.name}を読み込めませんでした。`));
    };
    image.src = objectUrl;
  });
}

function newJobImageId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function uploadPendingJobImages() {
  if (!pendingJobImageFiles.length) return { urls: [], paths: [] };
  const urls = [];
  const paths = [];
  try {
    for (const file of pendingJobImageFiles) {
      const blob = await createCompressedJobImage(file);
      const path = `${currentUser.id}/${newJobImageId()}.jpg`;
      const { error } = await supabaseClient.storage
        .from("job-media")
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
      if (error) throw error;
      paths.push(path);
      const { data } = supabaseClient.storage.from("job-media").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return { urls, paths };
  } catch (error) {
    if (paths.length) {
      const { error: cleanupError } = await supabaseClient.storage.from("job-media").remove(paths);
      if (cleanupError) console.error("失敗した画像アップロードの後片付けに失敗しました:", cleanupError);
    }
    throw error;
  }
}

function getOwnedJobImagePath(url) {
  if (!currentUser || typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/job-media/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const path = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
    return path.startsWith(`${currentUser.id}/`) ? path : null;
  } catch {
    return null;
  }
}

async function deleteUnreferencedJobImages(urls, excludedJobId = null) {
  if (!jobImagesSchemaReady || !currentUser || !urls.length) return [];
  const failedUrls = [];
  for (const url of new Set(urls)) {
    const path = getOwnedJobImagePath(url);
    if (!path) continue;
    let query = supabaseClient
      .from("published_jobs")
      .select("id")
      .eq("owner_id", currentUser.id)
      .contains("image_urls", [url])
      .limit(1);
    if (excludedJobId !== null) query = query.neq("id", excludedJobId);
    const { data: arrayReferences, error: arrayError } = await query;
    if (arrayError) {
      failedUrls.push(url);
      continue;
    }
    if (arrayReferences?.length) continue;
    let legacyQuery = supabaseClient
      .from("published_jobs")
      .select("id")
      .eq("owner_id", currentUser.id)
      .eq("image_url", url)
      .limit(1);
    if (excludedJobId !== null) legacyQuery = legacyQuery.neq("id", excludedJobId);
    const { data: legacyReferences, error: legacyError } = await legacyQuery;
    if (legacyError) {
      failedUrls.push(url);
      continue;
    }
    if (legacyReferences?.length) continue;
    const { error } = await supabaseClient.storage.from("job-media").remove([path]);
    if (error) failedUrls.push(url);
  }
  return failedUrls;
}

function renderJobImageGallery(job, className = "") {
  const images = getJobImages(job);
  if (!images.length) return "";
  return `<div class="${className} grid grid-cols-2 gap-2 sm:grid-cols-3">${images.map((url, index) => `
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="お仕事の写真 ${index + 1} を拡大表示" class="block overflow-hidden rounded-xl bg-gray-100">
      <img src="${escapeHtml(url)}" alt="お仕事の写真 ${index + 1}" loading="lazy" class="aspect-[4/3] w-full object-cover">
    </a>`).join("")}</div>`;
}
