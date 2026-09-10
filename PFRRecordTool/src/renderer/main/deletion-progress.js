/**
 * Deletion progress-panel controller.
 * Converts main-process progress snapshots into labels, counts, button states,
 * and pause/resume/retry actions. It does not calculate deletion progress itself.
 */
(() => {
  const { CHANNELS } = window.api.comm;

  const progressSection = document.getElementById("deletionProgress");
  const progressSummary = document.getElementById("deletionProgressSummary");
  const progressState = document.getElementById("deletionProgressState");
  const progressBar = document.getElementById("deletionProgressBar");
  const succeededCount = document.getElementById("deletionSucceeded");
  const failedCount = document.getElementById("deletionFailed");
  const remainingCount = document.getElementById("deletionRemaining");
  const workerCount = document.getElementById("deletionWorkerCount");
  const pauseButton = document.getElementById("pauseDeletionButton");
  const resumeButton = document.getElementById("resumeDeletionButton");
  const retryButton = document.getElementById("retryDeletionButton");

  function setDeletionTriggersDisabled(disabled) {
    [
      "bulkDeleteButton",
      "deleteAllRecords",
      "deleteDisplayed",
      "fetchPortalCustomersButton",
      "selectFileButton",
    ].forEach((id) => {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = disabled;
      }
    });
  }

  // Translate deletion lifecycle states into user-facing copy.
  function describeProgress(progress) {
    const label = progress.operation === "retry" ? "Retrying" : "Deleting";

    switch (progress.status) {
      case "running":
        return {
          badge: label,
          summary: `${progress.processed} of ${progress.total} processed.`,
        };
      case "cancelling":
        return {
          badge: "Pausing",
          summary: `Finishing ${progress.inFlight} in-flight request${progress.inFlight === 1 ? "" : "s"}.`,
        };
      case "paused":
        return {
          badge: "Paused",
          summary: `${progress.remaining} record${progress.remaining === 1 ? "" : "s"} ready to continue.`,
        };
      case "completed":
        return progress.failed > 0
          ? {
              badge: "Needs attention",
              summary: `${progress.succeeded} deleted. ${progress.failed} failed and can be retried.`,
            }
          : {
              badge: "Complete",
              summary: `All ${progress.succeeded} record${progress.succeeded === 1 ? "" : "s"} deleted.`,
            };
      default:
        return { badge: "Preparing", summary: "Preparing deletion…" };
    }
  }

  // Render one complete progress snapshot received from the deletion manager.
  function renderProgress(progress) {
    const copy = describeProgress(progress);
    progressSection.hidden = false;
    progressSection.dataset.status =
      progress.status === "completed" && progress.failed > 0
        ? "failed"
        : progress.status;
    progressState.textContent = copy.badge;
    progressSummary.textContent = copy.summary;
    progressBar.value = progress.progress;
    progressBar.setAttribute(
      "aria-valuetext",
      `${progress.processed} of ${progress.total} processed`,
    );
    succeededCount.textContent = progress.succeeded;
    failedCount.textContent = progress.failed;
    remainingCount.textContent = progress.remaining;
    if (["running", "cancelling"].includes(progress.status)) {
      workerCount.textContent = `${progress.concurrency} of ${progress.maxConcurrency} parallel workers active`;
    } else if (progress.concurrency > 0) {
      workerCount.textContent = `Processed with up to ${progress.concurrency} parallel workers`;
    } else {
      workerCount.textContent = "Waiting to start";
    }

    pauseButton.hidden =
      !progress.canCancel && progress.status !== "cancelling";
    pauseButton.disabled = progress.status === "cancelling";
    resumeButton.hidden = !progress.canResume;
    retryButton.hidden = !progress.canRetry;

    const deletionLocked = ["running", "cancelling", "paused"].includes(
      progress.status,
    );
    setDeletionTriggersDisabled(deletionLocked);
  }

  // Shared error handling for continuation and retry commands.
  async function invokeDeletionAction(channel, button) {
    button.disabled = true;
    try {
      await window.api.comm.invoke(channel);
    } catch (error) {
      progressSection.dataset.status = "error";
      progressState.textContent = "Action failed";
      progressSummary.textContent = error.message;
      button.disabled = false;
    }
  }

  pauseButton.addEventListener("click", () => {
    window.api.comm.send(CHANNELS.CANCEL_DELETION);
  });

  resumeButton.addEventListener("click", () => {
    invokeDeletionAction(CHANNELS.RESUME_DELETION, resumeButton);
  });

  retryButton.addEventListener("click", () => {
    invokeDeletionAction(CHANNELS.RETRY_FAILED_DELETIONS, retryButton);
  });

  window.api.comm.receive(CHANNELS.DELETION_PROGRESS, renderProgress);
})();
