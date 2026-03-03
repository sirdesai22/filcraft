export type MemoryTag =
  | "reasoning"
  | "memory"
  | "coding"
  | "vision"
  | "planning"
  | "tool-use";

export interface Memory {
  id: string;
  name: string;
  description: string;
  readme?: string;
  tags: MemoryTag[];
  cid: string;
  author: string;
  price: number;
  installs: number;
  version: string;
  createdAt: string;
  featured?: boolean;
  staffPick?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
  compatibleTags: MemoryTag[];
  installedMemories: number;
  price: number | "free";
  author: string;
}

export const MEMORY_TAGS: MemoryTag[] = [
  "reasoning",
  "memory",
  "coding",
  "vision",
  "planning",
  "tool-use",
];

export const MEMORIES: Memory[] = [
  {
    id: "chain-of-thought-pro",
    name: "Chain of Thought Pro",
    description:
      "Structured reasoning patterns for complex multi-step problem solving. Improves accuracy on math and logic tasks.",
    tags: ["reasoning", "planning"],
    cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    author: "@reasoning-labs",
    price: 0.4,
    installs: 2847,
    version: "1.2.0",
    createdAt: "2025-01-15",
    featured: true,
    staffPick: true,
    readme: `## Overview\n\nChain of Thought Pro provides structured reasoning patterns for complex multi-step problem solving. It improves accuracy on math and logic tasks by guiding the agent through explicit step-by-step reasoning.\n\n## Features\n\n- **Structured reasoning**: Breaks down problems into clear steps\n- **Math & logic**: Optimized for numerical and logical tasks\n- **Transparency**: Each reasoning step is visible and debuggable\n\n## Usage\n\nOnce installed, the memory is automatically loaded into your agent's context. No additional configuration required.`,
  },
  {
    id: "context-memory-v2",
    name: "Context Memory v2",
    description:
      "Long-term memory injection for agents. Persists key facts across sessions with semantic retrieval.",
    tags: ["memory"],
    cid: "bafybeih2x5q5n5q5n5q5n5q5n5q5n5q5n5q5n5q5n5q",
    author: "@memory-ai",
    price: 0.25,
    installs: 5123,
    version: "2.0.1",
    createdAt: "2025-02-01",
    staffPick: true,
  },
  {
    id: "code-review-assistant",
    name: "Code Review Assistant",
    description:
      "Memory for automated code review. Detects bugs, style issues, and suggests improvements.",
    tags: ["coding", "reasoning"],
    cid: "bafybeic3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d",
    author: "@devtools",
    price: 0.55,
    installs: 1892,
    version: "1.0.3",
    createdAt: "2025-02-10",
  },
  {
    id: "vision-analyzer",
    name: "Vision Analyzer",
    description:
      "Image and diagram understanding. Extracts structured data from screenshots, charts, and diagrams.",
    tags: ["vision", "reasoning"],
    cid: "bafybeid4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4",
    author: "@vision-labs",
    price: 0.6,
    installs: 923,
    version: "0.9.2",
    createdAt: "2025-02-18",
    featured: true,
  },
  {
    id: "task-planner",
    name: "Task Planner",
    description:
      "Hierarchical task decomposition. Breaks complex goals into executable subtasks with dependencies.",
    tags: ["planning", "reasoning"],
    cid: "bafybeie5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5",
    author: "@planning-ai",
    price: 0.35,
    installs: 3456,
    version: "1.1.0",
    createdAt: "2025-01-28",
  },
  {
    id: "tool-use-master",
    name: "Tool Use Master",
    description:
      "Orchestrates API calls, file ops, and external tools. Handles retries and error recovery.",
    tags: ["tool-use", "coding"],
    cid: "bafybeif6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6",
    author: "@toolsmith",
    price: 0.45,
    installs: 2156,
    version: "1.3.1",
    createdAt: "2025-02-05",
  },
  {
    id: "reasoning-scratchpad",
    name: "Reasoning Scratchpad",
    description:
      "Internal monologue for step-by-step reasoning. Improves transparency and debuggability.",
    tags: ["reasoning"],
    cid: "bafybeig7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7",
    author: "@reasoning-labs",
    price: 0.2,
    installs: 4123,
    version: "1.0.0",
    createdAt: "2025-01-20",
  },
  {
    id: "episodic-memory",
    name: "Episodic Memory",
    description:
      "Stores and recalls past interactions. Enables agents to reference prior conversations.",
    tags: ["memory"],
    cid: "bafybeih8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8",
    author: "@memory-ai",
    price: 0.3,
    installs: 2876,
    version: "1.5.0",
    createdAt: "2025-02-12",
  },
  {
    id: "refactoring-sense",
    name: "Refactoring Sense",
    description:
      "Identifies code smells and suggests refactors. Maintains consistency across codebases.",
    tags: ["coding"],
    cid: "bafybeii9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9",
    author: "@devtools",
    price: 0.4,
    installs: 1567,
    version: "0.8.1",
    createdAt: "2025-02-20",
  },
  {
    id: "chart-reader",
    name: "Chart Reader",
    description:
      "Extracts data from bar charts, line graphs, and pie charts. Outputs structured JSON.",
    tags: ["vision"],
    cid: "bafybeij0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0",
    author: "@vision-labs",
    price: 0.35,
    installs: 834,
    version: "1.0.0",
    createdAt: "2025-02-22",
  },
  {
    id: "goal-decomposer",
    name: "Goal Decomposer",
    description:
      "Splits high-level goals into actionable steps. Supports parallel and sequential execution.",
    tags: ["planning"],
    cid: "bafybeik1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1",
    author: "@planning-ai",
    price: 0.28,
    installs: 1923,
    version: "1.2.2",
    createdAt: "2025-02-08",
  },
  {
    id: "api-orchestrator",
    name: "API Orchestrator",
    description:
      "Manages multi-step API workflows. Handles auth, rate limits, and pagination.",
    tags: ["tool-use"],
    cid: "bafybeil2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2",
    author: "@toolsmith",
    price: 0.5,
    installs: 1234,
    version: "2.0.0",
    createdAt: "2025-02-25",
  },
  {
    id: "socratic-reasoner",
    name: "Socratic Reasoner",
    description:
      "Question-driven reasoning. Asks clarifying questions before committing to answers.",
    tags: ["reasoning", "planning"],
    cid: "bafybeim3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3",
    author: "@reasoning-labs",
    price: 0.38,
    installs: 987,
    version: "0.7.0",
    createdAt: "2025-02-26",
  },
  {
    id: "semantic-cache",
    name: "Semantic Cache",
    description:
      "Caches similar queries for faster responses. Reduces latency on repeated questions.",
    tags: ["memory", "tool-use"],
    cid: "bafybein4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4",
    author: "@memory-ai",
    price: 0.22,
    installs: 2345,
    version: "1.1.1",
    createdAt: "2025-02-15",
  },
  {
    id: "docstring-writer",
    name: "Docstring Writer",
    description:
      "Generates consistent docstrings for functions and classes. Supports multiple styles.",
    tags: ["coding"],
    cid: "bafybeio5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5",
    author: "@devtools",
    price: 0.15,
    installs: 3456,
    version: "1.0.2",
    createdAt: "2025-01-25",
  },
];

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

export function getMemoryById(id: string): Memory | undefined {
  return MEMORIES.find((e) => e.id === id);
}

export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}
