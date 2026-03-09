import { proxyActivities } from "@temporalio/workflow";

const { processMessage } = proxyActivities<{
  processMessage: (payload: Record<string, unknown>) => Promise<void>;
}>({
  startToCloseTimeout: "30 seconds",
});

export async function messageHandlerWorkflow(
  payload: Record<string, unknown>
): Promise<void> {
  await processMessage(payload);
}
