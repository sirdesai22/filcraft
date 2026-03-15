/**
 * Agent logo overrides — used when an agent's metadata.image is missing or fails to load.
 * Key: agentId (string), Value: absolute or relative URL to logo image.
 */
export const AGENT_LOGO_OVERRIDES: Record<string, string> = {
  "13": "/agents/investor-finder.svg",
};

/**
 * Resolve the image URL for an agent. Overrides take precedence when defined.
 */
export function resolveAgentImage(
  agentId: string,
  metadataImage?: string | null
): string | null {
  const override = AGENT_LOGO_OVERRIDES[agentId];
  if (override) return override;
  return metadataImage ?? null;
}
