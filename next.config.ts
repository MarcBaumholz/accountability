import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Runs as `node server.js` in a container on the Pi; `next start` does not
  // work against a standalone build.
  output: "standalone",
};

export default withSerwist(config);
