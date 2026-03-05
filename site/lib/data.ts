export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  compatibleTags: string[];
  installedMemories: number;
  price: number | "free";
  author: string;
}

export const AGENTS: Agent[] = [
  {
    id: "reasoner-x",
    name: "ReasonerX",
    description: "Specialized in multi-step reasoning and chain-of-thought tasks.",
    avatar: "🧠",
    compatibleTags: ["reasoning", "planning"],
    installedMemories: 12,
    price: 0.8,
    author: "@reasoning-labs",
  },
  {
    id: "code-pilot",
    name: "CodePilot",
    description: "Development assistant with code review and refactoring capabilities.",
    avatar: "💻",
    compatibleTags: ["coding", "reasoning", "tool-use"],
    installedMemories: 8,
    price: 1.2,
    author: "@devtools",
  },
  {
    id: "vision-agent",
    name: "VisionAgent",
    description: "Image and diagram understanding. Extracts insights from visual data.",
    avatar: "👁",
    compatibleTags: ["vision", "reasoning"],
    installedMemories: 5,
    price: 0.9,
    author: "@vision-labs",
  },
  {
    id: "memory-keeper",
    name: "MemoryKeeper",
    description: "Long-context agent with episodic and semantic memory.",
    avatar: "📚",
    compatibleTags: ["memory"],
    installedMemories: 6,
    price: "free",
    author: "@memory-ai",
  },
  {
    id: "task-master",
    name: "TaskMaster",
    description: "Planning and execution agent. Breaks goals into subtasks.",
    avatar: "📋",
    compatibleTags: ["planning", "reasoning", "tool-use"],
    installedMemories: 10,
    price: 0.6,
    author: "@planning-ai",
  },
  {
    id: "tool-runner",
    name: "ToolRunner",
    description: "Orchestrates external tools and APIs. Handles complex workflows.",
    avatar: "🔧",
    compatibleTags: ["tool-use", "coding"],
    installedMemories: 7,
    price: "free",
    author: "@toolsmith",
  },
  {
    id: "generalist-pro",
    name: "Generalist Pro",
    description: "Versatile agent supporting all memory types. Best for experimentation.",
    avatar: "🌟",
    compatibleTags: ["reasoning", "memory", "coding", "vision", "planning", "tool-use"],
    installedMemories: 24,
    price: 1.5,
    author: "@memfil",
  },
];

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}
