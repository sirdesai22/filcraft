import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import {
  baseSepolia,
  sepolia,
  celo,
  celoSepolia,
  filecoinCalibration,
} from "viem/chains";

export const config = createConfig({
  chains: [baseSepolia, sepolia, celo, celoSepolia, filecoinCalibration],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
    [celo.id]: http(),
    [celoSepolia.id]: http(),
    [filecoinCalibration.id]: http(
        "https://filecoin-calibration.chainup.net/rpc/v1"
    ),
  },
});
