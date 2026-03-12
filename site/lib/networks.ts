import type { Chain } from "viem";
import { sepolia, filecoinCalibration, baseSepolia } from "viem/chains";

export type NetworkId = "sepolia" | "filecoinCalibration" | "baseSepolia";

export interface NetworkConfig {
  id: NetworkId;
  name: string;
  chain: Chain;
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
  /** AgentEconomyRegistry — tracks budgets, storage costs, and survival. Deployed by deploy-economy.ts */
  economyRegistry?: `0x${string}`;
  explorerName: string;
  /** Base URL for token/NFT links, append agentId */
  explorerTokenUrl: string;
  /** Base URL for address links, append address */
  explorerAddressUrl: string;
  /** Base URL for transaction links, append txHash */
  explorerTxUrl: string;
  /** Subgraph URL for the IdentityRegistry (faster than RPC). Omit to use RPC. */
  subgraphUrl?: string;
  /** Separate Goldsky subgraph URL for the ReputationRegistry (Filecoin only). */
  reputationSubgraphUrl?: string;
  /** Max blocks to look back for deploy block (for RPCs with lookback limits, e.g. Filecoin ~16h) */
  maxLookbackBlocks?: number;
  /** Cap gas for writeContract calls (Filecoin block gas limit is 10B, below viem's default estimate) */
  transactionGasLimit?: bigint;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  filecoinCalibration: {
    id: "filecoinCalibration",
    name: "Filecoin Calibration",
    chain: filecoinCalibration,
    identityRegistry: "0xa450345b850088f68b8982c57fe987124533e194",
    reputationRegistry: "0x11bd1d7165a3b482ff72cbbb96068d1298a9d07c",
    economyRegistry: (process.env.AGENT_ECONOMY_REGISTRY_ADDRESS as `0x${string}`) || "0x87ca5e54a3afd16f3ff5101ffbede586bac1292a",
    explorerName: "Filscan",
    explorerTokenUrl:
      "https://calibration.filscan.io/token/0xa450345b850088f68b8982c57fe987124533e194?a=",
    explorerAddressUrl: "https://calibration.filscan.io/address/",
    explorerTxUrl: "https://calibration.filscan.io/tx/",
    subgraphUrl:
      process.env.SUBGRAPH_URL_FILECOIN_CALIBRATION ||
      "https://api.goldsky.com/api/public/project_cmmaf9dwcfw7s01zc9s19e8xf/subgraphs/erc8004-identity-registry-filecoin-testnet/1.0.0/gn",
    reputationSubgraphUrl:
      process.env.SUBGRAPH_URL_REPUTATION_FILECOIN_CALIBRATION ||
      "https://api.goldsky.com/api/public/project_cmmdjons870iu01xs5ih2aphi/subgraphs/erc8004-reputation-registry-filecoin-testnet/1.0.0/gn",
    // Filecoin Calibration block gas limit is 10B; viem's estimateGas can exceed it
    transactionGasLimit: BigInt(8_000_000_000),
  },
  sepolia: {
    id: "sepolia",
    name: "Ethereum Sepolia",
    chain: sepolia,
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    explorerName: "Etherscan",
    explorerTokenUrl:
      "https://sepolia.etherscan.io/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=",
    explorerAddressUrl: "https://sepolia.etherscan.io/address/",
    explorerTxUrl: "https://sepolia.etherscan.io/tx/",
    subgraphUrl:
      process.env.SUBGRAPH_URL_SEPOLIA ||
      "https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT",
  },
  baseSepolia: {
    id: "baseSepolia",
    name: "Base Sepolia",
    chain: baseSepolia,
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    explorerName: "Basescan",
    explorerTokenUrl:
      "https://sepolia.basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=",
    explorerAddressUrl: "https://sepolia.basescan.org/address/",
    explorerTxUrl: "https://sepolia.basescan.org/tx/",
  },
};

export const DEFAULT_NETWORK: NetworkId = "sepolia";

export const NETWORK_IDS = Object.keys(NETWORKS) as NetworkId[];

export function getNetwork(id: NetworkId): NetworkConfig {
  const config = NETWORKS[id];
  if (!config) throw new Error(`Unknown network: ${id}`);
  return config;
}

export function getExplorerUrl(networkId: NetworkId, agentId: string): string {
  return getNetwork(networkId).explorerTokenUrl + agentId;
}

export function getExplorerAddressUrl(networkId: NetworkId, address: string): string {
  return getNetwork(networkId).explorerAddressUrl + address;
}
