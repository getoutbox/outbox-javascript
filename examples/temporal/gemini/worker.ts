import { fileURLToPath } from "node:url";
import { DestinationEventType, OutboxClient } from "@outbox-sdk/outbox";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities.js";

const TASK_QUEUE = "outbox-messages";
const WORKFLOW_TYPE = "messageHandlerWorkflow";

async function main(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  });
  const worker = await Worker.create({
    connection,
    workflowsPath: fileURLToPath(new URL("../workflows.js", import.meta.url)),
    activities,
    taskQueue: TASK_QUEUE,
  });

  // Register (or update) the destination — upsert semantics make this safe
  // to call on every startup without creating duplicates.
  const outbox = new OutboxClient({ apiKey: process.env.OUTBOX_API_KEY! });
  await outbox.destinations.create({
    destinationId: "temporal-gemini",
    displayName: "Temporal Gemini agent",
    target: {
      case: "temporal",
      value: {
        address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
        namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
        taskQueue: TASK_QUEUE,
        workflowType: WORKFLOW_TYPE,
        apiKey: process.env.TEMPORAL_API_KEY ?? "",
      },
    },
    eventTypes: [DestinationEventType.MESSAGE],
  });

  await worker.run();
}

main().catch(console.error);
