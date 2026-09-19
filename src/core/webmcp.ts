import type { Track } from "./model";
interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (
    input: Record<string, unknown>,
  ) => Promise<{ content: { type: "text"; text: string }[] }>;
}
interface ModelContext {
  registerTool: (tool: Tool) => void;
  unregisterTool: (name: string) => void;
}
/** Optional progressive enhancement; no polyfill, network, or dependency on agent tooling. */
export function registerWorkshopTools(
  getTrack: () => Track,
  loadPreset: (name: string) => void,
) {
  const context = (navigator as Navigator & { modelContext?: ModelContext })
    .modelContext;
  if (!context?.registerTool || !context.unregisterTool) return () => {};
  const tools: Tool[] = [
    {
      name: "marble_run_get_track",
      description:
        "Read the current Marble Run Lab construction and saved settings.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async () => ({
        content: [{ type: "text", text: JSON.stringify(getTrack()) }],
      }),
    },
    {
      name: "marble_run_load_preset",
      description:
        "Replace the current workbench with a built-in preset. This edit is recoverable with Undo. Does not publish or send any data.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            enum: ["First Drop", "The Spiral", "Loop Theory"],
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
      execute: async (input) => {
        if (
          !["First Drop", "The Spiral", "Loop Theory"].includes(
            String(input.name),
          )
        )
          throw new Error("Unknown preset.");
        loadPreset(String(input.name));
        return {
          content: [
            {
              type: "text",
              text: `Loaded ${String(input.name)}. Undo restores the previous track.`,
            },
          ],
        };
      },
    },
  ];
  try {
    tools.forEach((tool) => context.registerTool(tool));
  } catch {
    return () => {};
  }
  return () => {
    for (const tool of tools)
      try {
        context.unregisterTool(tool.name);
      } catch {
        /* Optional browser API. */
      }
  };
}
