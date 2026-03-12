import { createPublicClient, http, parseAbi } from "viem";
import { filecoinCalibration } from "viem/chains";

export const DATA_LISTING_REGISTRY_ADDRESS =
  (process.env.DATA_LISTING_REGISTRY_ADDRESS as `0x${string}`) ||
  "0xdd6c9772e4a3218f8ca7acbaeeea2ce02eb1dbf6";

export const DATA_ESCROW_ADDRESS =
  (process.env.DATA_ESCROW_ADDRESS as `0x${string}`) ||
  "0xd2abb8a5b534f04c98a05dcfeede92ad89c37f57";

export const MOCK_USDC_ADDRESS =
  (process.env.MOCK_USDC_ADDRESS as `0x${string}`) ||
  "0x4784c6adb8600e081aa4f3e1d04f8bfbbc51dcce";

export const PLATFORM_FEE_BPS = 250; // 2.5%

export const REGISTRY_ABI = parseAbi([
  "function totalListings() view returns (uint256)",
  "function getListing(uint256 id) view returns (uint256 id, string contentCid, address producer, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri, bool active, uint256 createdAt)",
  "function getListingsBatch(uint256 fromId, uint256 toId) view returns ((uint256 id, string contentCid, address producer, uint256 agentId, uint256 priceUsdc, string license, string category, string metadataUri, bool active, uint256 createdAt)[])",
]);

export const ESCROW_ABI = parseAbi([
  "function purchase(uint256 listingId) returns (uint256 purchaseId)",
  "function confirmDelivery(uint256 purchaseId)",
  "function getPurchase(uint256 id) view returns (uint256 listingId, address buyer, address seller, uint256 amount, uint256 platformFee, bool settled, bool refunded, uint256 createdAt)",
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount)",
]);

export interface DataListing {
  id: string;
  contentCid: string;
  producer: string;
  agentId: string;
  priceUsdc: string; // raw 6-decimal string for JSON serialization
  license: string;
  category: string;
  metadataUri: string;
  active: boolean;
  createdAt: string;
}

function createClient() {
  return createPublicClient({
    chain: filecoinCalibration,
    transport: http(
      process.env.FILECOIN_CALIBRATION_RPC_URL ||
        "https://api.calibration.node.glif.io/rpc/v1"
    ),
  });
}

export async function fetchDataListings(options?: {
  category?: string;
}): Promise<{ listings: DataListing[]; total: number }> {
  const client = createClient();

  const total = await client.readContract({
    address: DATA_LISTING_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "totalListings",
  });

  if (total === 0n) return { listings: [], total: 0 };

  const raw = await client.readContract({
    address: DATA_LISTING_REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "getListingsBatch",
    args: [1n, total],
  });

  const listings: DataListing[] = raw
    .filter((l) => l.active)
    .filter((l) => !options?.category || l.category === options.category)
    .map((l) => ({
      id: l.id.toString(),
      contentCid: l.contentCid,
      producer: l.producer,
      agentId: l.agentId.toString(),
      priceUsdc: l.priceUsdc.toString(),
      license: l.license,
      category: l.category,
      metadataUri: l.metadataUri,
      active: l.active,
      createdAt: l.createdAt.toString(),
    }));

  // Newest first
  listings.sort((a, b) => Number(b.id) - Number(a.id));

  return { listings, total: listings.length };
}

export async function fetchDataListingById(id: string): Promise<DataListing | null> {
  const client = createClient();
  try {
    const raw = await client.readContract({
      address: DATA_LISTING_REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "getListing",
      args: [BigInt(id)],
    });
    // Returns tuple: [id, contentCid, producer, agentId, priceUsdc, license, category, metadataUri, active, createdAt]
    const arr = raw as readonly [bigint, string, string, bigint, bigint, string, string, string, boolean, bigint];
    if (!arr[0]) return null;
    return {
      id: arr[0].toString(),
      contentCid: arr[1],
      producer: arr[2],
      agentId: arr[3].toString(),
      priceUsdc: arr[4].toString(),
      license: arr[5],
      category: arr[6],
      metadataUri: arr[7],
      active: arr[8],
      createdAt: arr[9].toString(),
    };
  } catch {
    return null;
  }
}
