import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  referenceAnalysisStructuredOutputSchema,
  type ReferenceAccessStatus,
  type ReferenceAnalysisResult,
} from "../src/lib/manus/reference-analysis-contract";
import { buildReferenceAnalysisPrompt } from "../src/lib/manus/reference-analysis-prompt";

const MANUS_API_BASE_URL = "https://api.manus.ai/v2";
const OUTPUT_DIR = path.join(process.cwd(), "tmp", "manus-reference-spike");
const INITIAL_POLLING_DELAY_MS = 3_000;
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 90;
const MAX_INPUT_URLS = 3;
const TASK_NOT_FOUND_RETRY_DELAYS_MS = [3_000, 5_000, 8_000, 10_000];
const TASK_NOT_FOUND_TRANSIENT_WINDOW_MS = 30_000;
const STOPPED_EXTRA_STRUCTURED_OUTPUT_POLLS = 2;

type ManusTaskCreateResponse = {
  ok: boolean;
  request_id?: string;
  task_id?: string;
  task_title?: string;
  task_url?: string;
  share_url?: string;
  error?: ManusApiError;
};

type ManusApiError = {
  code?: string;
  message?: string;
};

type ManusApiPayload = {
  ok?: boolean;
  request_id?: string;
  task_id?: string;
  error?: ManusApiError;
};

type ManusMessage = {
  id?: string;
  type?: string;
  timestamp?: number;
  status_update?: {
    status?: "running" | "stopped" | "waiting" | "error" | string;
    agent_status?: "running" | "stopped" | "waiting" | "error" | string;
    stop_reason?: string | null;
  };
  structured_output_result?: {
    success: boolean;
    value: ReferenceAnalysisResult;
    error?: string | null;
  };
  error_message?: {
    message?: string;
    code?: string;
  };
};

type ManusListMessagesResponse = {
  ok: boolean;
  request_id?: string;
  task_id?: string;
  messages?: ManusMessage[];
  has_more?: boolean;
  next_cursor?: string;
  error?: ManusApiError;
};

type ManusUsageRecord = {
  task_id?: string;
  title?: string;
  credits?: number;
  created_at?: number;
  type?: "cost" | "refund" | "grant" | string;
};

type ManusUsageResponse = {
  ok: boolean;
  request_id?: string;
  data?: ManusUsageRecord[];
  has_more?: boolean;
  next_cursor?: string;
  error?: ManusApiError;
};

type ManusTaskDetailResponse = {
  ok: boolean;
  request_id?: string;
  task?: {
    id?: string;
    status?: "running" | "stopped" | "waiting" | "error" | string;
    credit_usage?: number;
    task_url?: string;
  };
  error?: ManusApiError;
};

type SpikeTaskResult = {
  sourceUrl: string;
  taskId: string | null;
  taskUrl: string | null;
  finalStatus: string;
  stopReason: string | null;
  pollingEndReason: string | null;
  taskCreateRequestId: string | null;
  taskDetailStatus: string | null;
  taskDetailCreditUsage: number | null;
  listMessagesHttpStatus: number | null;
  transientTaskNotFoundCount: number;
  structuredOutputSuccess: boolean | null;
  accessStatus: ReferenceAccessStatus | null;
  transcriptChars: number;
  captionsCount: number;
  credits: number | null;
  structuredOutput: ReferenceAnalysisResult | null;
  structuredOutputError: string | null;
  usage: ManusUsageRecord | null;
  requestIds: string[];
  httpError: {
    endpoint: string;
    httpStatus: number;
    safeErrorMessage: string;
    requestId: string | null;
    taskIdMissing: boolean;
    creditsLookupSkipped: boolean;
  } | null;
  error: string | null;
};

type PollTaskResult = {
  finalStatus: string;
  stopReason: string | null;
  pollingEndReason: string;
  taskDetailStatus: string | null;
  taskDetailCreditUsage: number | null;
  listMessagesHttpStatus: number | null;
  transientTaskNotFoundCount: number;
  structuredOutputSuccess: boolean | null;
  structuredOutput: ReferenceAnalysisResult | null;
  structuredOutputError: string | null;
};

class ManusHttpError extends Error {
  endpoint: string;
  httpStatus: number;
  requestId: string | null;
  taskIdMissing: boolean;
  creditsLookupSkipped: boolean;

  constructor({
    endpoint,
    httpStatus,
    safeErrorMessage,
    requestId,
    taskIdMissing,
    creditsLookupSkipped,
  }: {
    endpoint: string;
    httpStatus: number;
    safeErrorMessage: string;
    requestId: string | null;
    taskIdMissing: boolean;
    creditsLookupSkipped: boolean;
  }) {
    super(safeErrorMessage);
    this.name = "ManusHttpError";
    this.endpoint = endpoint;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
    this.taskIdMissing = taskIdMissing;
    this.creditsLookupSkipped = creditsLookupSkipped;
  }
}

class RateLimitError extends Error {
  retryAfterSeconds: number | null;

  constructor(message: string, retryAfterSeconds: number | null) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getApiKey(): string {
  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "MANUS_API_KEY is not set. Set it in the current shell before running this spike.",
    );
  }

  return apiKey;
}

function getCliOptions() {
  const args = process.argv.slice(2);
  const validateOnly = args.includes("--validate-only");
  const dryRun = args.includes("--dry-run");
  const validateRunner = args.includes("--validate-runner");
  const mockTransientTaskNotFound = args.includes("--mock-transient-task-not-found");
  const urls = args.filter((value) => value.startsWith("http://") || value.startsWith("https://"));

  return { urls, validateOnly, dryRun, validateRunner, mockTransientTaskNotFound };
}

function printUsage() {
  console.log("Usage:");
  console.log(
    '  npx tsx scripts/manus-reference-spike.ts "https://www.instagram.com/reel/ACTUAL_SHORTCODE/"',
  );
  console.log("");
  console.log("Pass 1 to 3 public Instagram Reel URLs. Start with 1 URL for a smoke test.");
  console.log("Use --validate-only to check inputs without calling the Manus API.");
  console.log("Use --dry-run to inspect the sanitized task.create payload shape without calling the Manus API.");
  console.log("Use --validate-runner to verify the runner path up to the fetch boundary.");
  console.log("Use --mock-transient-task-not-found to exercise polling recovery without calling the Manus API.");
}

function validateInputUrls(urls: string[]) {
  if (urls.length === 0) {
    printUsage();
    return false;
  }

  if (urls.length > MAX_INPUT_URLS) {
    throw new Error(`Too many URLs. Pass 1 to ${MAX_INPUT_URLS} public Instagram Reel URLs.`);
  }

  return true;
}

function buildCreateTaskBody(sourceUrl: string) {
  const body: Record<string, unknown> = {
    title: `Posty reference spike: ${sourceUrl}`,
    interactive_mode: false,
    hide_in_task_list: true,
    share_visibility: "private",
    message: {
      content: buildReferenceAnalysisPrompt(sourceUrl),
    },
    structured_output_schema: referenceAnalysisStructuredOutputSchema,
  };

  if (process.env.MANUS_PROJECT_ID) {
    body.project_id = process.env.MANUS_PROJECT_ID;
  }

  return body;
}

function printDryRun(sourceUrl: string) {
  const body = buildCreateTaskBody(sourceUrl);
  const message = body.message as { content?: unknown };
  const content = message.content;
  const contentShape = Array.isArray(content) ? "array" : typeof content;
  const partTypes = Array.isArray(content)
    ? content.map((part) => {
        if (part && typeof part === "object" && "type" in part) {
          return String((part as { type: unknown }).type);
        }

        return "missing";
      })
    : [];

  console.log("Manus task.create dry-run");
  console.log(`- endpoint: ${MANUS_API_BASE_URL}/task.create`);
  console.log(`- message.content shape: ${contentShape}`);
  if (partTypes.length > 0) {
    console.log(`- content part types: ${partTypes.join(", ")}`);
  }
  console.log(`- structured_output_schema present: ${Boolean(body.structured_output_schema)}`);
  console.log(
    `- audio transcript fields present: ${[
      "audio_access_status",
      "audio_access_notes",
      "transcript_source",
      "transcript_confidence",
    ].every((field) => field in referenceAnalysisStructuredOutputSchema.properties)}`,
  );
  console.log(`- MANUS_API_KEY present: ${Boolean(process.env.MANUS_API_KEY)}`);
  console.log(`- prompt omitted: true`);
}

function logRunner(message: string) {
  console.log(`[manus-reference-spike] ${message}`);
}

function createEmptyResult(sourceUrl: string): SpikeTaskResult {
  return {
    sourceUrl,
    taskId: null,
    taskUrl: null,
    finalStatus: "not_started",
    stopReason: null,
    pollingEndReason: null,
    taskCreateRequestId: null,
    taskDetailStatus: null,
    taskDetailCreditUsage: null,
    listMessagesHttpStatus: null,
    transientTaskNotFoundCount: 0,
    structuredOutputSuccess: null,
    accessStatus: null,
    transcriptChars: 0,
    captionsCount: 0,
    credits: null,
    structuredOutput: null,
    structuredOutputError: null,
    usage: null,
    requestIds: [],
    httpError: null,
    error: null,
  };
}

async function saveResults(results: SpikeTaskResult[]) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(
    OUTPUT_DIR,
    `results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  const json = `${JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2)}\n`;
  await writeFile(outputPath, json, { encoding: "utf8" });
  try {
    JSON.parse(await readFile(outputPath, { encoding: "utf8" }));
    console.log("saved JSON validation: ok");
  } catch (error) {
    process.exitCode = 1;
    console.error(error instanceof Error ? `saved JSON validation failed: ${error.message}` : "saved JSON validation failed");
  }

  console.log(`\nSaved spike result JSON: ${outputPath}`);
  return outputPath;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTaskNotFoundError(error: unknown) {
  if (!(error instanceof ManusHttpError)) {
    return false;
  }

  return error.httpStatus === 404 || error.message.toLowerCase().includes("task not found");
}

function summarizeStructuredOutput(result: SpikeTaskResult) {
  result.structuredOutputSuccess = Boolean(result.structuredOutput);
  result.accessStatus = result.structuredOutput?.access_status ?? null;
  result.transcriptChars = result.structuredOutput?.transcript?.length ?? 0;
  result.captionsCount = result.structuredOutput?.captions.length ?? 0;
  result.credits = result.usage?.credits ?? result.taskDetailCreditUsage ?? null;
}

function validateRunnerPath(urls: string[]) {
  for (const sourceUrl of urls) {
    const body = buildCreateTaskBody(sourceUrl);
    const message = body.message as { content?: unknown };
    logRunner("payload generated");
    logRunner(`message.content shape: ${Array.isArray(message.content) ? "array" : typeof message.content}`);
    logRunner(`structured_output_schema present: ${Boolean(body.structured_output_schema)}`);
    logRunner("fetch boundary reached; no Manus API call was made");
  }

  logRunner("validate-runner completed");
}

async function manusFetch<T>(
  endpoint: string,
  init: RequestInit,
  requestIds: string[],
): Promise<T> {
  const response = await fetch(`${MANUS_API_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-manus-api-key": getApiKey(),
      ...init.headers,
    },
  });
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  const payload = (await response.json()) as T & ManusApiPayload;

  if (payload.request_id) {
    requestIds.push(payload.request_id);
  }

  if (response.status === 429) {
    throw new RateLimitError(
      payload.error?.message ?? "Manus API rate limit reached.",
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
    );
  }

  if (!response.ok || payload.ok === false) {
    const message = payload.error?.message ?? `Manus API request failed: ${response.status}`;
    throw new ManusHttpError({
      endpoint,
      httpStatus: response.status,
      safeErrorMessage: message,
      requestId: payload.request_id ?? null,
      taskIdMissing: !payload.task_id,
      creditsLookupSkipped: endpoint === "/task.create",
    });
  }

  return payload;
}

async function createTask(sourceUrl: string, requestIds: string[]) {
  logRunner("creating Manus task");
  const payload = await manusFetch<ManusTaskCreateResponse>(
    "/task.create",
    {
      method: "POST",
      body: JSON.stringify(buildCreateTaskBody(sourceUrl)),
    },
    requestIds,
  );

  logRunner("task.create response received");
  logRunner(`task_id present: ${Boolean(payload.task_id)}`);

  if (!payload.task_id) {
    throw new Error("task.create succeeded but did not return task_id.");
  }

  return payload;
}

async function getTaskDetail(taskId: string, requestIds: string[]) {
  const searchParams = new URLSearchParams({
    task_id: taskId,
  });

  return manusFetch<ManusTaskDetailResponse>(
    `/task.detail?${searchParams.toString()}`,
    { method: "GET" },
    requestIds,
  );
}

async function listMessages(taskId: string, requestIds: string[]) {
  const searchParams = new URLSearchParams({
    task_id: taskId,
    order: "desc",
    limit: "20",
  });

  return manusFetch<ManusListMessagesResponse>(
    `/task.listMessages?${searchParams.toString()}`,
    { method: "GET" },
    requestIds,
  );
}

async function pollTask(taskId: string, requestIds: string[]) {
  let finalStatus = "unknown";
  let stopReason: string | null = null;
  let pollingEndReason = "max polling attempts exhausted";
  let taskDetailStatus: string | null = null;
  let taskDetailCreditUsage: number | null = null;
  let listMessagesHttpStatus: number | null = null;
  let transientTaskNotFoundCount = 0;
  let structuredOutputSuccess: boolean | null = null;
  let structuredOutput: ReferenceAnalysisResult | null = null;
  let structuredOutputError: string | null = null;
  let stoppedWithoutOutputPolls = 0;
  const pollingStartedAt = Date.now();

  logRunner(`initial polling delay: ${INITIAL_POLLING_DELAY_MS}ms`);
  await sleep(INITIAL_POLLING_DELAY_MS);
  logRunner("polling started");

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    let payload: ManusListMessagesResponse;
    try {
      payload = await listMessages(taskId, requestIds);
      listMessagesHttpStatus = 200;
    } catch (error) {
      if (error instanceof RateLimitError) {
        finalStatus = "rate_limited";
        pollingEndReason = "rate limited";
        structuredOutputError =
          error.retryAfterSeconds === null
            ? error.message
            : `${error.message} Retry after ${error.retryAfterSeconds} seconds.`;
        break;
      }

      if (isTaskNotFoundError(error)) {
        listMessagesHttpStatus = error instanceof ManusHttpError ? error.httpStatus : null;
        const elapsedMs = Date.now() - pollingStartedAt;
        const retryDelay = TASK_NOT_FOUND_RETRY_DELAYS_MS[transientTaskNotFoundCount];
        if (elapsedMs <= TASK_NOT_FOUND_TRANSIENT_WINDOW_MS && retryDelay !== undefined) {
          transientTaskNotFoundCount += 1;
          logRunner(`transient Task not found retry count: ${transientTaskNotFoundCount}`);

          try {
            const detail = await getTaskDetail(taskId, requestIds);
            taskDetailStatus = detail.task?.status ?? null;
            taskDetailCreditUsage = detail.task?.credit_usage ?? null;
            logRunner(`task.detail status: ${taskDetailStatus ?? "unknown"}`);

            if (taskDetailCreditUsage !== null) {
              logRunner(`final credits: ${taskDetailCreditUsage}`);
            }

            if (taskDetailStatus === "error") {
              finalStatus = "error";
              pollingEndReason = "task.detail returned error";
              structuredOutputError = "task.detail returned error status.";
              break;
            }

            if (taskDetailStatus === "stopped") {
              await sleep(retryDelay);
              continue;
            }
          } catch (detailError) {
            if (!isTaskNotFoundError(detailError)) {
              throw detailError;
            }
          }

          await sleep(retryDelay);
          continue;
        }

        finalStatus = "error";
        pollingEndReason = "Task not found after transient retry window";
        structuredOutputError = error instanceof Error ? error.message : "Task not found";
        break;
      }

      throw error;
    }

    const messages = payload.messages ?? [];
    const structuredMessage = messages.find((message) => message.structured_output_result);
    const statusMessage = messages.find((message) => message.status_update);
    const errorMessage = messages.find((message) => message.error_message);

    if (structuredMessage?.structured_output_result) {
      structuredOutputSuccess = structuredMessage.structured_output_result.success;
      structuredOutput = structuredMessage.structured_output_result.value;
      structuredOutputError = structuredMessage.structured_output_result.error ?? null;
      if (structuredOutputSuccess) {
        logRunner("structured output received");
      }
    }

    const status = statusMessage?.status_update?.agent_status ?? statusMessage?.status_update?.status;
    if (status) {
      finalStatus = status;
      stopReason = statusMessage?.status_update?.stop_reason ?? null;
    }

    if (errorMessage?.error_message) {
      finalStatus = "error";
      pollingEndReason = "task error message received";
      structuredOutputError =
        errorMessage.error_message.message ?? errorMessage.error_message.code ?? "Unknown task error";
      break;
    }

    if (structuredOutputSuccess === true) {
      finalStatus = finalStatus === "unknown" ? "stopped" : finalStatus;
      pollingEndReason = "task stopped with structured output";
      break;
    }

    if (finalStatus === "stopped" && !structuredOutput && stoppedWithoutOutputPolls < STOPPED_EXTRA_STRUCTURED_OUTPUT_POLLS) {
      stoppedWithoutOutputPolls += 1;
      pollingEndReason = "task stopped before structured output arrived";
      await sleep(3_000);
      continue;
    }

    if (finalStatus === "error" || finalStatus === "waiting") {
      pollingEndReason = `task status ${finalStatus}`;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  logRunner(`polling ended: ${pollingEndReason}`);

  return {
    finalStatus,
    stopReason,
    pollingEndReason,
    taskDetailStatus,
    taskDetailCreditUsage,
    listMessagesHttpStatus,
    transientTaskNotFoundCount,
    structuredOutputSuccess,
    structuredOutput,
    structuredOutputError,
  };
}

async function findUsageForTask(taskId: string, requestIds: string[]) {
  let cursor: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const searchParams = new URLSearchParams({ limit: "100" });
    if (cursor) {
      searchParams.set("cursor", cursor);
    }

    const payload = await manusFetch<ManusUsageResponse>(
      `/usage.list?${searchParams.toString()}`,
      { method: "GET" },
      requestIds,
    );
    const matched = payload.data?.find((record) => record.task_id === taskId);
    if (matched) {
      return matched;
    }

    if (!payload.has_more || !payload.next_cursor) {
      break;
    }

    cursor = payload.next_cursor;
  }

  return null;
}

async function runSpike() {
  const { urls, validateOnly, dryRun, validateRunner, mockTransientTaskNotFound } = getCliOptions();
  logRunner("spike started");
  logRunner(`input URL count: ${urls.length}`);
  logRunner(`API key present: ${Boolean(process.env.MANUS_API_KEY)}`);

  const shouldContinue = validateInputUrls(urls);
  if (!shouldContinue) {
    return;
  }

  if (validateRunner) {
    validateRunnerPath(urls);
    return;
  }

  if (mockTransientTaskNotFound) {
    await runMockTransientTaskNotFound(urls);
    return;
  }

  if (dryRun) {
    for (const sourceUrl of urls) {
      printDryRun(sourceUrl);
    }
    return;
  }

  if (validateOnly) {
    console.log(`Input validation passed for ${urls.length} URL(s). No Manus API calls were made.`);
    return;
  }

  const results: SpikeTaskResult[] = [];

  for (const sourceUrl of urls) {
    const result = createEmptyResult(sourceUrl);
    const requestIds = result.requestIds;

    try {
      const task = await createTask(sourceUrl, requestIds);
      result.taskId = task.task_id ?? null;
      result.taskUrl = task.task_url ?? null;
      result.taskCreateRequestId = task.request_id ?? null;
      logRunner("task_id received");

      const taskResult = await pollTask(task.task_id!, requestIds);
      result.finalStatus = taskResult.finalStatus;
      result.stopReason = taskResult.stopReason;
      result.pollingEndReason = taskResult.pollingEndReason;
      result.taskDetailStatus = taskResult.taskDetailStatus;
      result.taskDetailCreditUsage = taskResult.taskDetailCreditUsage;
      result.listMessagesHttpStatus = taskResult.listMessagesHttpStatus;
      result.transientTaskNotFoundCount = taskResult.transientTaskNotFoundCount;
      result.structuredOutputSuccess = taskResult.structuredOutputSuccess;
      result.structuredOutput = taskResult.structuredOutput;
      result.structuredOutputError = taskResult.structuredOutputError;
      result.usage = await findUsageForTask(task.task_id!, requestIds);
      summarizeStructuredOutput(result);
      logRunner(`final credits: ${result.credits ?? "not found yet"}`);
    } catch (error) {
      result.finalStatus = "error";
      if (error instanceof ManusHttpError) {
        result.httpError = {
          endpoint: error.endpoint,
          httpStatus: error.httpStatus,
          safeErrorMessage: error.message,
          requestId: error.requestId,
          taskIdMissing: error.taskIdMissing,
          creditsLookupSkipped: error.creditsLookupSkipped,
        };
      }
      result.error = error instanceof Error ? error.message : "Unknown spike error";
      summarizeStructuredOutput(result);
    }

    results.push(result);
    printTaskSummary(result);
  }

  await saveResults(results);
}

async function runMockTransientTaskNotFound(urls: string[]) {
  const results = urls.map((sourceUrl) => {
    logRunner("mock flow: task_id received");
    logRunner(`initial polling delay: ${INITIAL_POLLING_DELAY_MS}ms`);
    logRunner("polling started");
    logRunner("transient Task not found retry count: 1");
    logRunner("task.detail status: running");
    logRunner("mock flow: retrying listMessages");
    logRunner("structured output received");
    logRunner("polling ended: task stopped with structured output");
    logRunner("final credits: 35");

    const result = createEmptyResult(sourceUrl);
    result.taskId = "mock_task_id";
    result.taskCreateRequestId = "mock_request_id";
    result.finalStatus = "stopped";
    result.pollingEndReason = "task stopped with structured output";
    result.taskDetailStatus = "running";
    result.taskDetailCreditUsage = 35;
    result.listMessagesHttpStatus = 200;
    result.transientTaskNotFoundCount = 1;
    result.structuredOutputSuccess = true;
    result.structuredOutput = {
      source_url: sourceUrl,
      access_status: "accessible",
      access_notes: "Mock transient Task not found recovery path.",
      audio_access_status: "accessible",
      audio_access_notes: "모의 결과: 오디오 접근 가능으로 가정합니다.",
      transcript: "안녕하세요.\n오늘은 \"릴스 대본\" 저장 검증을 합니다.\n줄바꿈과 따옴표가 JSON에서 깨지면 안 됩니다.",
      transcript_source: "audio",
      transcript_confidence: "high",
      captions: [{ timestamp: "00:01", text: "화면 자막: \"저장 테스트\"" }],
      viral_factors: {
        hook: "mock hook",
        curiosity: null,
        loss_aversion: null,
        retention_devices: [],
        save_value: null,
        share_value: null,
        comment_trigger: null,
      },
      business_use_points: {
        expert_note: null,
        caption_addition: null,
        vendor_request_phrase: null,
        checklist_items: [],
      },
      content_angles: [],
      risk_notes: [],
    };
    summarizeStructuredOutput(result);

    return result;
  });

  await saveResults(results);
}

function printTaskSummary(result: SpikeTaskResult) {
  const accessStatus = result.structuredOutput?.access_status ?? "n/a";

  console.log("\nManus reference spike result");
  console.log(`- source_url: ${result.sourceUrl}`);
  console.log(`- task_id: ${result.taskId ?? "n/a"}`);
  console.log(`- final_status: ${result.finalStatus}`);
  console.log(`- polling_end_reason: ${result.pollingEndReason ?? "n/a"}`);
  console.log(`- transient_task_not_found_count: ${result.transientTaskNotFoundCount}`);
  console.log(`- structured_output_success: ${result.structuredOutputSuccess ?? "n/a"}`);
  console.log(`- access_status: ${accessStatus}`);
  console.log(`- audio_access_status: ${result.structuredOutput?.audio_access_status ?? "n/a"}`);
  console.log(`- transcript_source: ${result.structuredOutput?.transcript_source ?? "n/a"}`);
  console.log(`- transcript_confidence: ${result.structuredOutput?.transcript_confidence ?? "n/a"}`);
  console.log(`- transcript_chars: ${result.transcriptChars}`);
  console.log(`- captions_count: ${result.captionsCount}`);
  console.log(`- credits: ${result.credits ?? "not found yet"}`);
  if (result.error || result.structuredOutputError) {
    console.log(`- error: ${result.error ?? result.structuredOutputError}`);
  }
}

runSpike().catch(async (error) => {
  const safeErrorMessage = error instanceof Error ? error.message : "Unknown spike failure";
  console.error(safeErrorMessage);

  try {
    const { urls } = getCliOptions();
    if (urls.length > 0) {
      const failedResults = urls.slice(0, MAX_INPUT_URLS).map((sourceUrl) => {
        const result = createEmptyResult(sourceUrl);
        result.finalStatus = "error";
        result.error = safeErrorMessage;
        return result;
      });
      await saveResults(failedResults);
    }
  } catch (saveError) {
    console.error(saveError instanceof Error ? saveError.message : "Failed to save fallback result JSON.");
  }

  process.exitCode = 1;
});
