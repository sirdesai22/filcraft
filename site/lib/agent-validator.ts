export interface AgentCard {
  type?: string;
  name?: string;
  description?: string;
  image?: string;
  active?: boolean;
  x402Support?: boolean;
  healthUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  services?: any[];
  [key: string]: unknown;
}

export interface ParsedServices {
  x402Endpoint: string;
  cost: string;
  currency: string;
  network: string;
  inputSchema?: object;
  healthUrl: string;
}

export interface ValidationResult {
  valid: boolean;
  agentCard: AgentCard | null;
  parsedServices: ParsedServices | null;
  errors: string[];
}

const REQUIRED_FIELDS: (keyof AgentCard)[] = ["name", "description", "image", "services"];

export function parseAgentCardServices(card: AgentCard): ParsedServices | null {
  const services = card.services;
  if (!Array.isArray(services)) return null;

  // Find x402 service — check for type: 'x402' or payment.protocol: 'x402'
  const x402Service = services.find(
    (s) =>
      s?.type === "x402" ||
      s?.payment?.protocol === "x402"
  );

  if (!x402Service) return null;

  const endpoint: string =
    x402Service.endpoint ?? "";
  const cost: string =
    x402Service.cost ?? x402Service.payment?.amount ?? "";
  const currency: string =
    x402Service.currency ?? x402Service.payment?.currency ?? "USDC";
  const network: string =
    x402Service.network ?? x402Service.payment?.network ?? "";
  const inputSchema: object | undefined =
    x402Service.inputSchema ?? undefined;

  const healthUrl: string = card.healthUrl ?? "";

  return { x402Endpoint: endpoint, cost, currency, network, inputSchema, healthUrl };
}

export async function validateAgentCard(url: string): Promise<ValidationResult> {
  const errors: string[] = [];

  let agentCard: AgentCard | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      errors.push(`Agent card returned HTTP ${res.status}`);
      return { valid: false, agentCard: null, parsedServices: null, errors };
    }
    agentCard = (await res.json()) as AgentCard;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`Failed to fetch agent card: ${msg}`);
    return { valid: false, agentCard: null, parsedServices: null, errors };
  }

  // Validate required ERC-8004 fields
  for (const field of REQUIRED_FIELDS) {
    if (!agentCard[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (agentCard.services && !Array.isArray(agentCard.services)) {
    errors.push("services must be an array");
  }

  const parsedServices = parseAgentCardServices(agentCard);
  if (!parsedServices) {
    errors.push("No x402 service found in services[]");
  }

  return {
    valid: errors.length === 0,
    agentCard,
    parsedServices,
    errors,
  };
}

export async function checkAgentHealth(healthUrl: string): Promise<boolean> {
  if (!healthUrl) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const body = await res.json();
    return body?.status === "ok" || body?.ok === true;
  } catch {
    return false;
  }
}
