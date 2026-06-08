const MANUS_API_BASE_URL = "https://api.manus.ai/v2";
const WEBHOOK_URL = "https://project-zzg5e.vercel.app/api/webhooks/manus";

type WebhookRecord = {
  id: string;
  url: string;
  status?: string;
};

type WebhookListResponse = {
  ok: boolean;
  request_id?: string;
  data?: WebhookRecord[];
  error?: { message?: string; code?: string };
};

type WebhookCreateResponse = {
  ok: boolean;
  request_id?: string;
  webhook?: WebhookRecord;
  error?: { message?: string; code?: string };
};

function hasApplyFlag() {
  return process.argv.includes("--apply");
}

function getApiKey() {
  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) {
    throw new Error("MANUS_API_KEY is not set.");
  }

  return apiKey;
}

async function manusFetch<T>(endpoint: string, init: RequestInit = {}) {
  const response = await fetch(`${MANUS_API_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-manus-api-key": getApiKey(),
      ...init.headers,
    },
  });
  const payload = (await response.json()) as T & {
    ok?: boolean;
    error?: { message?: string; code?: string };
  };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error?.message ?? `Manus webhook request failed: ${response.status}`);
  }

  return payload;
}

async function run() {
  console.log("Manus webhook registration helper");
  console.log(`- target_url: ${WEBHOOK_URL}`);
  console.log(`- apply: ${hasApplyFlag()}`);
  console.log(`- MANUS_API_KEY present: ${Boolean(process.env.MANUS_API_KEY)}`);

  if (!hasApplyFlag()) {
    console.log("- dry_run: true");
    console.log("No Manus API call was made. Re-run with --apply to list/create webhooks.");
    return;
  }

  const list = await manusFetch<WebhookListResponse>("/webhook.list", { method: "GET" });
  const existing = list.data?.find((webhook) => webhook.url === WEBHOOK_URL);

  if (existing) {
    console.log(`- existing_webhook_id: ${existing.id}`);
    console.log(`- existing_webhook_status: ${existing.status ?? "unknown"}`);
    return;
  }

  const created = await manusFetch<WebhookCreateResponse>("/webhook.create", {
    method: "POST",
    body: JSON.stringify({ url: WEBHOOK_URL }),
  });

  console.log(`- created_webhook_id: ${created.webhook?.id ?? "unknown"}`);
  console.log(`- created_webhook_status: ${created.webhook?.status ?? "unknown"}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown webhook registration error.");
  process.exitCode = 1;
});

export {};
