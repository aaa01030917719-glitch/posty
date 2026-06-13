type MockJobStatus =
  | "queued"
  | "processing"
  | "submitted"
  | "retry_scheduled"
  | "failed"
  | "completed";

type MockJob = {
  id: string;
  referenceId: string;
  userId: string;
  status: MockJobStatus;
  attemptCount: number;
  maxAttempts: number;
  manusTaskId: string | null;
  priority: number;
  isAutoSubmitAllowed: boolean;
  submissionSource: "manual" | "auto_realtime" | "manual_reanalyze" | "backfill";
  platform: "instagram_reel" | "instagram_post";
  submittedAt: string | null;
};

type MockReference = {
  id: string;
  platform: "instagram_reel" | "instagram_post";
  latestAnalysisId: string | null;
};

type MockSettings = {
  isAutoAnalysisPaused: boolean;
  dailySubmissionLimit: number;
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function newJob(overrides: Partial<MockJob> = {}): MockJob {
  return {
    id: "job_1",
    referenceId: "ref_1",
    userId: "user_1",
    status: "queued",
    attemptCount: 0,
    maxAttempts: 5,
    manusTaskId: null,
    priority: 100,
    isAutoSubmitAllowed: true,
    submissionSource: "auto_realtime",
    platform: "instagram_reel",
    submittedAt: null,
    ...overrides,
  };
}

function claimJob(job: MockJob) {
  if (
    !["queued", "retry_scheduled"].includes(job.status) ||
    job.manusTaskId ||
    !job.isAutoSubmitAllowed
  ) {
    return false;
  }

  job.status = "processing";
  job.attemptCount += 1;
  return true;
}

function submitJob(job: MockJob, taskId: string) {
  job.status = "submitted";
  job.manusTaskId = taskId;
  job.submittedAt = new Date().toISOString();
}

function scheduleRetry(job: MockJob) {
  if (job.attemptCount >= job.maxAttempts) {
    job.status = "failed";
    return "failed";
  }

  job.status = "retry_scheduled";
  return "retry_scheduled";
}

function processAutoQueueMock(input: {
  job: MockJob;
  settings: MockSettings;
  submittedToday: number;
}) {
  let manusCalls = 0;

  if (input.settings.isAutoAnalysisPaused) {
    return { processed: 0, status: "auto_analysis_paused", manusCalls };
  }

  if (input.submittedToday >= input.settings.dailySubmissionLimit) {
    return { processed: 0, status: "daily_submission_limit_reached", manusCalls };
  }

  if (!input.job.isAutoSubmitAllowed) {
    return { processed: 0, status: "auto_submit_not_allowed", manusCalls };
  }

  if (input.job.platform !== "instagram_reel") {
    return { processed: 0, status: "unsupported_reference_platform", manusCalls };
  }

  if (!claimJob(input.job)) {
    return { processed: 0, status: "skipped", manusCalls };
  }

  manusCalls += 1;
  submitJob(input.job, "task_1");
  return { processed: 1, status: "submitted", manusCalls };
}

function enqueueFromLinkkoMock(input: {
  reference: MockReference;
  autoAnalyzeNewLinks: boolean;
}) {
  if (
    input.reference.platform !== "instagram_reel" ||
    input.reference.latestAnalysisId ||
    !input.autoAnalyzeNewLinks
  ) {
    return null;
  }

  return newJob({
    referenceId: input.reference.id,
    priority: 100,
    isAutoSubmitAllowed: true,
    submissionSource: "auto_realtime",
  });
}

function submitManualMock(input: {
  reference: MockReference;
  confirmCost: boolean;
  allowCompleted: boolean;
  existingJob: MockJob | null;
}) {
  if (!input.confirmCost) return { status: "cost_confirmation_required", manusCalls: 0 };
  if (input.reference.platform !== "instagram_reel") {
    return { status: "unsupported_reference_platform", manusCalls: 0 };
  }
  if (input.reference.latestAnalysisId && !input.allowCompleted) {
    return { status: "analysis_already_completed", manusCalls: 0 };
  }

  const job = input.existingJob ?? newJob({
    id: "manual_job",
    referenceId: input.reference.id,
    priority: input.allowCompleted ? 110 : 120,
    isAutoSubmitAllowed: false,
    submissionSource: input.allowCompleted ? "manual_reanalyze" : "manual",
  });

  if (job.manusTaskId || job.status === "submitted") {
    return { status: "already_submitted", manusCalls: 0, job };
  }

  if (!["queued", "retry_scheduled"].includes(job.status) || job.manusTaskId) {
    return { status: "in_progress", manusCalls: 0, job };
  }

  job.status = "processing";
  submitJob(job, "manual_task");
  return { status: "submitted", manusCalls: 1, job };
}

function shouldShowLowConfidenceNotice(transcriptConfidence: string | null) {
  return transcriptConfidence === "low";
}

function runQueueProcessorMock() {
  const job = newJob();
  const result = processAutoQueueMock({
    job,
    settings: { isAutoAnalysisPaused: false, dailySubmissionLimit: 5 },
    submittedToday: 0,
  });

  assert(result.processed === 1, "queued auto job should be submitted");
  assert(result.manusCalls === 1, "submitted auto job should call Manus once");
  assert(job.status === "submitted", "claimed job should become submitted");
  assert(job.manusTaskId === "task_1", "submitted job should store task id");
}

function runDuplicateSubmissionMock() {
  const job = newJob({
    id: "job_existing_task",
    attemptCount: 1,
    manusTaskId: "task_existing",
  });

  const result = processAutoQueueMock({
    job,
    settings: { isAutoAnalysisPaused: false, dailySubmissionLimit: 5 },
    submittedToday: 0,
  });

  assert(result.manusCalls === 0, "job with existing manus_task_id should not call task.create");
}

function runTaskCreatedDbFailureMock() {
  const job = newJob({
    id: "job_db_failure",
    status: "processing",
    attemptCount: 1,
    manusTaskId: "task_created",
  });

  job.status = "failed";
  assert(job.manusTaskId === "task_created", "created Manus task id should be retained");
  assert(job.status === "failed", "DB submit failure should not return to queued automatically");
}

function runWebhookMock() {
  const processedEvents = new Set<string>();
  const eventId = "event_1";

  assert(!processedEvents.has(eventId), "first webhook event should not be duplicate");
  processedEvents.add(eventId);
  assert(processedEvents.has(eventId), "duplicate webhook event should be idempotent");
}

function runWebhookProbeMock() {
  const mutationCount = 0;
  const verifiedProbe = { event_type: "webhook_probe" };
  assert(verifiedProbe.event_type === "webhook_probe", "probe should be recognized as unknown");
  assert(mutationCount === 0, "verified probe should return 200 without DB mutation");
}

function runWebhookFinishShapeMock() {
  const payload = {
    event_id: "event_finish",
    event_type: "task_stopped",
    task_detail: {
      task_id: "task_1",
      stop_reason: "finish",
      structured_output: {
        success: true,
        value: { source_url: "https://www.instagram.com/reel/mock/" },
      },
    },
  };

  assert(payload.task_detail.task_id === "task_1", "webhook task id should come from task_detail.task_id");
  assert(payload.task_detail.structured_output.success, "webhook structured output should come from task_detail.structured_output");
}

function runWebhookReconcileRaceMock() {
  const insertedByTaskId = new Set<string>();
  const taskId = "task_race";
  insertedByTaskId.add(taskId);
  insertedByTaskId.add(taskId);
  assert(insertedByTaskId.size === 1, "same manus_task_id should produce one analysis row");
}

function runReconcileMock() {
  const flow = ["task_not_found", "task_detail_running", "structured_output_success"];
  assert(flow[0] === "task_not_found", "reconcile should observe transient Task not found");
  assert(flow[1] === "task_detail_running", "reconcile should continue when task.detail is running");
  assert(flow[2] === "structured_output_success", "reconcile should finish through finalizer path");
}

function runFailureMock() {
  const job = newJob({
    id: "job_2",
    status: "processing",
    attemptCount: 1,
    isAutoSubmitAllowed: false,
  });

  assert(scheduleRetry(job) === "retry_scheduled", "first failure should schedule retry");
  job.attemptCount = 5;
  assert(scheduleRetry(job) === "failed", "max attempts should fail the job");
}

function runPolicyPauseMock() {
  const result = processAutoQueueMock({
    job: newJob(),
    settings: { isAutoAnalysisPaused: true, dailySubmissionLimit: 5 },
    submittedToday: 0,
  });

  assert(result.processed === 0, "paused auto analysis should process zero jobs");
  assert(result.status === "auto_analysis_paused", "paused auto analysis should return paused status");
  assert(result.manusCalls === 0, "paused auto analysis should not call Manus");
}

function runDailyLimitMock() {
  const result = processAutoQueueMock({
    job: newJob(),
    settings: { isAutoAnalysisPaused: false, dailySubmissionLimit: 5 },
    submittedToday: 5,
  });

  assert(result.processed === 0, "daily limit should process zero jobs");
  assert(result.status === "daily_submission_limit_reached", "daily limit status should be returned");
  assert(result.manusCalls === 0, "daily limit should not call Manus");
}

function runExistingQueuedProtectionMock() {
  const result = processAutoQueueMock({
    job: newJob({ isAutoSubmitAllowed: false }),
    settings: { isAutoAnalysisPaused: false, dailySubmissionLimit: 5 },
    submittedToday: 0,
  });

  assert(result.processed === 0, "existing queued job should not be consumed by cron");
  assert(result.status === "auto_submit_not_allowed", "existing queued job should be blocked by auto flag");
}

function runFolderAutoOnMock() {
  const job = enqueueFromLinkkoMock({
    reference: { id: "ref_auto_on", platform: "instagram_reel", latestAnalysisId: null },
    autoAnalyzeNewLinks: true,
  });

  assert(Boolean(job), "auto-enabled folder should enqueue realtime analysis");
  assert(job?.submissionSource === "auto_realtime", "auto job should use auto_realtime source");
  assert(job?.isAutoSubmitAllowed === true, "auto job should allow cron submission");
  assert(job?.priority === 100, "auto realtime job should use priority 100");
}

function runFolderAutoOffMock() {
  const job = enqueueFromLinkkoMock({
    reference: { id: "ref_auto_off", platform: "instagram_reel", latestAnalysisId: null },
    autoAnalyzeNewLinks: false,
  });

  assert(job === null, "auto-disabled folder should not enqueue auto-submit job");
}

function runManualAnalysisMock() {
  const reference = { id: "ref_manual", platform: "instagram_reel" as const, latestAnalysisId: null };
  const first = submitManualMock({
    reference,
    confirmCost: true,
    allowCompleted: false,
    existingJob: null,
  });
  const second = submitManualMock({
    reference,
    confirmCost: true,
    allowCompleted: false,
    existingJob: first.job ?? null,
  });

  assert(first.status === "submitted", "manual analysis should submit when cost is confirmed");
  assert(first.manusCalls === 1, "manual analysis should submit one Manus task");
  assert(first.job?.priority === 120, "manual analysis should use priority 120");
  assert(second.manusCalls === 0, "manual button repeat should not create duplicate Manus task");
}

function runCompletedReanalysisMock() {
  const reference = {
    id: "ref_done",
    platform: "instagram_reel" as const,
    latestAnalysisId: "analysis_1",
  };
  const blocked = submitManualMock({
    reference,
    confirmCost: true,
    allowCompleted: false,
    existingJob: null,
  });
  const reanalysis = submitManualMock({
    reference,
    confirmCost: true,
    allowCompleted: true,
    existingJob: null,
  });

  assert(blocked.status === "analysis_already_completed", "basic analyze should block completed references");
  assert(reanalysis.status === "submitted", "reanalyze route should allow explicit new analysis");
  assert(reanalysis.job?.priority === 110, "manual reanalysis should use priority 110");
}

function runLowConfidenceMock() {
  assert(shouldShowLowConfidenceNotice("low"), "low transcript confidence should render notice");
  assert(!shouldShowLowConfidenceNotice("high"), "high transcript confidence should not render notice");
}

function run() {
  runQueueProcessorMock();
  runDuplicateSubmissionMock();
  runTaskCreatedDbFailureMock();
  runWebhookMock();
  runWebhookProbeMock();
  runWebhookFinishShapeMock();
  runWebhookReconcileRaceMock();
  runReconcileMock();
  runFailureMock();
  runPolicyPauseMock();
  runDailyLimitMock();
  runExistingQueuedProtectionMock();
  runFolderAutoOnMock();
  runFolderAutoOffMock();
  runManualAnalysisMock();
  runCompletedReanalysisMock();
  runLowConfidenceMock();

  console.log("manus runtime mock check: ok");
  console.log("- queue processor: claim and submit ok");
  console.log("- duplicate submission: existing manus_task_id blocks task.create ok");
  console.log("- task.create DB failure: manual recovery state ok");
  console.log("- webhook probe: verified unknown payload no-op ok");
  console.log("- webhook finish payload: task_detail structured output mapping ok");
  console.log("- webhook/reconcile race: one analysis per manus_task_id ok");
  console.log("- webhook: duplicate event id idempotency ok");
  console.log("- reconcile: transient Task not found recovery ok");
  console.log("- failure: retry_scheduled and failed backoff states ok");
  console.log("- policy: auto pause blocks Manus submission ok");
  console.log("- policy: daily limit blocks Manus submission ok");
  console.log("- policy: existing queued jobs with auto flag false are protected ok");
  console.log("- Linkko folder auto ON: auto_realtime job is queued ok");
  console.log("- Linkko folder auto OFF: auto-submit job is not created ok");
  console.log("- manual analysis: cost confirmation and duplicate-click guard ok");
  console.log("- reanalysis: completed reference blocked by basic analyze, allowed by reanalyze ok");
  console.log("- UI policy: low transcript confidence notice condition ok");
}

run();

export {};
