import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const outputPath = join(process.cwd(), "src", "data", "validator-info.json");

const raw = execFileSync(
  "solana",
  ["-um", "validator-info", "get", "--output", "json-compact"],
  {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);

const entries = JSON.parse(raw);
const validators = Object.fromEntries(
  entries
    .map((entry) => {
      const identityPubkey = String(entry.identityPubkey || "").trim();
      const name = String(entry.info?.name || "").trim();

      if (!identityPubkey || !name) {
        return null;
      }

      return [identityPubkey, name];
    })
    .filter(Boolean)
    .sort((left, right) => left[0].localeCompare(right[0])),
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      cluster: "mainnet-beta",
      validators,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `Wrote ${Object.keys(validators).length} validator-info names to ${outputPath}`,
);
