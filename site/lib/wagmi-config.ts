import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { sepolia, filecoinCalibration, baseSepolia } from "viem/chains";

export const config = createConfig({
  chains: [sepolia, filecoinCalibration, baseSepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(),
    [filecoinCalibration.id]: http(
      "https://api.calibration.node.glif.io/rpc/v1"
    ),
    [baseSepolia.id]: http(),
  },
});
