import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { sepolia, filecoinCalibration } from "viem/chains";

export const config = createConfig({
  chains: [sepolia, filecoinCalibration],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(),
    [filecoinCalibration.id]: http(
      "https://filecoin-calibration.chainup.net/rpc/v1"
    ),
  },
});
