import { readFileSync } from "node:fs";
import { join } from "node:path";
import OffenderBoardTabs from "./offender-board-tabs";
import WallOfShameTabs from "./wall-of-shame-tabs";

type ValidatorEntry = {
  identityPubkey: string;
  name: string | null;
};

type LegacyValidator = ValidatorEntry;

type ValidatorInfoSnapshot = {
  generatedAt: string;
  cluster: string;
  validators: Record<string, string>;
};

type GistFile = {
  filename: string;
  raw_url: string;
  content?: string;
  truncated?: boolean;
};

type GistResponse = {
  html_url: string;
  updated_at: string;
  description: string | null;
  files: Record<string, GistFile>;
};

type BoardDefinition = {
  key: "metrics" | "xdp";
  title: string;
  description: string;
  issueLabel: string;
  gistId: string;
};

type BoardData = BoardDefinition & {
  sourceUrl: string;
  rawUrl: string;
  sourceDescription: string;
  updatedLabel: string;
  validators: ValidatorEntry[];
  count: number;
  namedCount: number;
  anonymousCount: number;
  featured: ValidatorEntry | null;
};

type CaseEntry = ValidatorEntry & {
  boardKey: BoardDefinition["key"];
  boardTitle: string;
  issueLabel: string;
};

export const dynamic = "force-dynamic";

const LEGACY_TESTNET_SOURCE_URL =
  "https://discord.com/channels/428295358100013066/849749936916267029/1506864933353160767";
const LEGACY_TESTNET_CUTOFF_DATE = "05/20/2026";
const XDP_GUIDE_URL = "https://www.anza.xyz/blog/agave-xdp-setup-guide";

const checks = [
  "--experimental-retransmit-xdp-cpu-cores 1",
  "--experimental-retransmit-xdp-zero-copy # Do NOT pass this flag when using the bnxt_en driver.",
  "--experimental-poh-pinned-cpu-core 10",
];

const boardDefinitions: BoardDefinition[] = [
  {
    key: "metrics",
    title: "Metrics Wall of Shame",
    description:
      "Agave mainnet identity pubkeys currently listed as not reporting metrics.",
    issueLabel: "Metrics Missing",
    gistId: "cf7c0dd10bec618563322cadbbc8099c",
  },
  {
    key: "xdp",
    title: "XDP Wall of Shame",
    description:
      "Agave mainnet identity pubkeys currently listed with xdp=false.",
    issueLabel: "XDP False",
    gistId: "40360f22e8d61738da97201b478a34d6",
  },
];

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function pickFeatured(validators: ValidatorEntry[]) {
  const pool = pickNamedOrAny(validators);

  return pool.length ? shuffle(pool)[0] : null;
}

function pickNamedOrAny<T extends { name: string | null }>(items: T[]) {
  const namedItems = items.filter((item) => item.name);
  return namedItems.length ? namedItems : items;
}

function groupNamedValidatorsFirst<T extends { name: string | null }>(items: T[]) {
  const namedItems = items.filter((item) => item.name);
  const unnamedItems = items.filter((item) => !item.name);

  return [...shuffle(namedItems), ...shuffle(unnamedItems)];
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell);
  return cells;
}

function parsePubkeyList(content: string) {
  return [...new Set(content.split(/\r?\n/).map((line) => line.trim()))].filter(
    Boolean,
  );
}

function normalizeName(name: string | undefined | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

function formatCaseNumber(index: number) {
  return String(index).padStart(3, "0");
}

function readLegacyTestnetValidators(): LegacyValidator[] {
  const csvPath = join(process.cwd(), "public", "validators.csv");
  const [, ...rows] = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);

  return rows
    .map((row) => {
      const [identityPubkey, name] = parseCsvLine(row);
      return {
        identityPubkey,
        name: normalizeName(name),
      };
    })
    .sort((left, right) => {
      if (left.name && !right.name) return -1;
      if (!left.name && right.name) return 1;

      return (left.name || left.identityPubkey).localeCompare(
        right.name || right.identityPubkey,
      );
    });
}

function readValidatorInfoSnapshot(): ValidatorInfoSnapshot {
  const snapshotPath = join(
    process.cwd(),
    "src",
    "data",
    "validator-info.json",
  );

  return JSON.parse(readFileSync(snapshotPath, "utf8")) as ValidatorInfoSnapshot;
}

async function fetchText(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

async function fetchBoard(
  definition: BoardDefinition,
  validatorNames: Record<string, string>,
): Promise<BoardData> {
  const response = await fetch(
    `https://api.github.com/gists/${definition.gistId}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch gist ${definition.gistId}: ${response.status}`,
    );
  }

  const gist = (await response.json()) as GistResponse;
  const file = Object.values(gist.files)[0];

  if (!file) {
    throw new Error(`No gist file found for ${definition.gistId}`);
  }

  const content =
    file.truncated || !file.content
      ? await fetchText(file.raw_url)
      : file.content;

  const validators = groupNamedValidatorsFirst(
    parsePubkeyList(content).map((identityPubkey) => ({
      identityPubkey,
      name: normalizeName(validatorNames[identityPubkey]),
    })),
  );

  const namedCount = validators.filter((validator) => validator.name).length;

  return {
    ...definition,
    sourceUrl: gist.html_url,
    rawUrl: file.raw_url,
    sourceDescription: gist.description || definition.title,
    updatedLabel: formatTimestamp(gist.updated_at),
    validators,
    count: validators.length,
    namedCount,
    anonymousCount: validators.length - namedCount,
    featured: pickFeatured(validators),
  };
}

function boardTheme(key: BoardDefinition["key"]) {
  if (key === "metrics") {
    return {
      badge:
        "border-[#d6ff3f]/35 bg-[#d6ff3f]/10 text-[#d6ff3f]",
      cardBorder: "border-[#d6ff3f]/18",
      headline: "text-[#d6ff3f]",
      statBg: "bg-[#d6ff3f]",
      statText: "text-[#17140f]",
      pill:
        "border-[#d6ff3f]/20 bg-[#d6ff3f]/8 text-[#d6ff3f]",
      rowHover: "hover:bg-[#d6ff3f]/5",
    };
  }

  return {
    badge:
      "border-[#ff6a2a]/35 bg-[#ff6a2a]/10 text-[#ffb188]",
    cardBorder: "border-[#ff6a2a]/18",
    headline: "text-[#ffb188]",
    statBg: "bg-[#ff6a2a]",
    statText: "text-[#1a110c]",
    pill:
      "border-[#ff6a2a]/20 bg-[#ff6a2a]/8 text-[#ffb188]",
    rowHover: "hover:bg-[#ff6a2a]/5",
  };
}

function toCaseEntry(board: BoardData, validator: ValidatorEntry): CaseEntry {
  return {
    ...validator,
    boardKey: board.key,
    boardTitle: board.title,
    issueLabel: board.issueLabel,
  };
}

function caseEntryId(entry: CaseEntry) {
  return `${entry.boardKey}:${entry.identityPubkey}`;
}

function buildHeroCaseDeck(boards: BoardData[]) {
  const combinedPool = boards.flatMap((board) =>
    board.validators.map((validator) => toCaseEntry(board, validator)),
  );
  const shuffledCombined = shuffle(pickNamedOrAny(combinedPool));
  const currentDefendant = shuffledCombined[0] || null;
  const excluded = new Set<string>();

  if (currentDefendant) {
    excluded.add(caseEntryId(currentDefendant));
  }

  const caseFiles: CaseEntry[] = [];

  for (const board of boards) {
    const boardPool = shuffle(
      pickNamedOrAny(board.validators).map((validator) =>
        toCaseEntry(board, validator),
      ),
    );
    const boardCase = boardPool.find(
      (candidate) => !excluded.has(caseEntryId(candidate)),
    );

    if (boardCase) {
      caseFiles.push(boardCase);
      excluded.add(caseEntryId(boardCase));
    }
  }

  const reserveCase = shuffledCombined.find(
    (candidate) => !excluded.has(caseEntryId(candidate)),
  );

  if (reserveCase) {
    caseFiles.push(reserveCase);
  }

  return {
    currentDefendant,
    caseFiles: caseFiles.slice(0, 3),
  };
}

function renderMainnetBoard(board: BoardData) {
  const theme = boardTheme(board.key);

  return (
    <section
      key={board.key}
      className={`overflow-hidden rounded-[1.5rem] border ${theme.cardBorder} bg-[#0f0d0a]`}
    >
      <div className="border-b border-[#f3ead8]/10 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] ${theme.badge}`}
            >
              mainnet
            </span>
            <h2
              className={`font-display mt-4 text-3xl font-black tracking-[-0.05em] sm:text-4xl ${theme.headline}`}
            >
              {board.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c9bea8] sm:text-base">
              {board.description}
            </p>
          </div>

          <div
            className={`rounded-[1.25rem] px-5 py-4 ${theme.statBg} ${theme.statText}`}
          >
            <p className="text-xs font-black uppercase tracking-[0.2em]">
              flagged
            </p>
            <p className="font-display mt-2 text-4xl font-black leading-none tracking-[-0.05em]">
              {board.count}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-[#918b7d]">
          <span>Updated {board.updatedLabel}</span>
          <span>Named {board.namedCount}</span>
          <span>Identity only {board.anonymousCount}</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <a
            href={board.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-full bg-[#f3ead8] px-4 py-3 font-bold text-[#17140f] transition hover:bg-[#d6ff3f]"
          >
            Open gist
          </a>
          <a
            href={board.rawUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-full border border-[#f3ead8]/15 px-4 py-3 font-bold text-[#f3ead8] transition hover:border-[#d6ff3f]/40 hover:text-[#d6ff3f]"
          >
            Raw list
          </a>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="overflow-hidden rounded-[1.35rem] border border-[#f3ead8]/12 bg-[#120f0c]">
          <div className="border-b border-[#f3ead8]/10 p-4">
            <p className="text-sm uppercase tracking-[0.24em] text-[#918b7d]">
              validator ledger
            </p>
            <p className="mt-2 text-sm leading-6 text-[#c9bea8]">
              Published validator name when available. Identity pubkey
              otherwise.
            </p>
          </div>

          <div className="max-h-[580px] overflow-auto md:hidden">
            <div className="divide-y divide-[#f3ead8]/10">
              {board.validators.map((validator, index) => (
                <article key={validator.identityPubkey} className="p-4">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-[#918b7d]">
                    <span>{String(index + 1).padStart(3, "0")}</span>
                    <span
                      className={`rounded-full border px-3 py-1 font-bold ${theme.pill}`}
                    >
                      {board.issueLabel}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-[#f3ead8]">
                    {validator.name || "Unpublished validator-info"}
                  </h3>
                  <p className="mt-2 break-all font-mono text-xs leading-6 text-[#c9bea8]">
                    {validator.identityPubkey}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="hidden max-h-[580px] overflow-auto md:block">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#17120d] text-xs uppercase tracking-[0.22em] text-[#918b7d]">
                <tr>
                  <th className="border-b border-[#f3ead8]/10 px-5 py-4 font-bold">
                    #
                  </th>
                  <th className="border-b border-[#f3ead8]/10 px-5 py-4 font-bold">
                    Validator name
                  </th>
                  <th className="border-b border-[#f3ead8]/10 px-5 py-4 font-bold">
                    Identity pubkey
                  </th>
                  <th className="border-b border-[#f3ead8]/10 px-5 py-4 font-bold">
                    Issue
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.validators.map((validator, index) => (
                  <tr
                    key={validator.identityPubkey}
                    className={`border-b border-[#f3ead8]/8 transition ${theme.rowHover}`}
                  >
                    <td className="px-5 py-4 font-bold text-[#918b7d]">
                      {String(index + 1).padStart(3, "0")}
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#f3ead8]">
                      {validator.name || "Unpublished validator-info"}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-[#c9bea8]">
                      {validator.identityPubkey}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${theme.pill}`}
                      >
                        {board.issueLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#f3ead8]/10 p-4 text-sm text-[#c9bea8]">
            Source:{" "}
            <a
              href={board.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[#d6ff3f] underline decoration-[#d6ff3f]/40 underline-offset-4 transition hover:text-[#f3ead8]"
            >
              {board.sourceDescription}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function renderTestnetArchive(
  validators: LegacyValidator[],
  featured: ValidatorEntry | null,
) {
  const namedCount = validators.filter((validator) => validator.name).length;
  const anonymousCount = validators.length - namedCount;

  return (
    <section className="space-y-5">
      <section className="rounded-[1.5rem] border border-[#f3ead8]/15 bg-[#120f0c] p-6">
        <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#918b7d]">
              operator notes
            </p>
            <h2 className="font-display mt-4 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              Historical testnet list
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c9bea8] sm:text-base">
              Historical validator list from Discord. Treat it as accurate
              before {LEGACY_TESTNET_CUTOFF_DATE}.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
              <span className="rounded-full border border-[#f3ead8]/15 px-4 py-3 text-[#f3ead8]">
                Total {validators.length}
              </span>
              <span className="rounded-full border border-[#f3ead8]/15 px-4 py-3 text-[#f3ead8]">
                Named {namedCount}
              </span>
              <span className="rounded-full border border-[#f3ead8]/15 px-4 py-3 text-[#f3ead8]">
                Anonymous {anonymousCount}
              </span>
              <span className="rounded-full border border-[#d6ff3f]/25 bg-[#d6ff3f]/10 px-4 py-3 text-[#d6ff3f]">
                Accurate before {LEGACY_TESTNET_CUTOFF_DATE}
              </span>
            </div>

            <a
              href={LEGACY_TESTNET_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#f3ead8] px-5 py-3 text-sm font-black text-[#17140f] transition hover:bg-[#d6ff3f]"
            >
              Open original Discord source
            </a>
          </div>

          <div className="rounded-[1.35rem] border border-[#f3ead8]/12 bg-[#0d0b09] p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-[#918b7d]">
              featured legacy case
            </p>
            <h3 className="font-display mt-4 text-3xl font-black tracking-[-0.05em] text-[#d6ff3f]">
              {featured?.name || "Unpublished"}
            </h3>
            <p className="mt-4 break-all font-mono text-sm leading-6 text-[#f3ead8]">
              {featured?.identityPubkey || "No validators available."}
            </p>
            <p className="mt-6 text-sm leading-6 text-[#c9bea8]">
              Some entries only have a pubkey and no published name.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-[#f3ead8]/15 bg-[#0d0b09]">
        <div className="flex flex-col gap-4 border-b border-[#f3ead8]/15 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#918b7d]">
              testnet ledger
            </p>
            <h2 className="font-display mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              Original validator identities and names
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#c9bea8]">
            Historical validator list from Discord.
          </p>
        </div>

        <div className="max-h-[620px] overflow-auto md:hidden">
          <div className="divide-y divide-[#f3ead8]/10">
            {validators.map((validator, index) => (
              <article key={validator.identityPubkey} className="p-4">
                <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-[#918b7d]">
                  <span>{String(index + 1).padStart(3, "0")}</span>
                  <span className="rounded-full border border-[#f3ead8]/15 px-3 py-1 font-bold text-[#c9bea8]">
                    {validator.name ? "named" : "blank"}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-[#d6ff3f]">
                  {validator.name || "Unpublished"}
                </h3>
                <p className="mt-2 break-all font-mono text-xs leading-6 text-[#f3ead8]">
                  {validator.identityPubkey}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="hidden max-h-[620px] overflow-auto md:block">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#17120d] text-xs uppercase tracking-[0.22em] text-[#918b7d]">
              <tr>
                <th className="border-b border-[#f3ead8]/10 px-5 py-4 font-bold">
                  #
                </th>
                <th className="border-b border-[#f3ead8]/10 px-5 py-4 font-bold">
                  Identity pubkey
                </th>
                <th className="border-b border-[#f3ead8]/10 px-5 py-4 font-bold">
                  Validator name
                </th>
                <th className="border-b border-[#f3ead8]/10 px-5 py-4 font-bold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {validators.map((validator, index) => (
                <tr
                  key={validator.identityPubkey}
                  className="border-b border-[#f3ead8]/8 transition hover:bg-[#d6ff3f]/5"
                >
                  <td className="px-5 py-4 font-bold text-[#918b7d]">
                    {String(index + 1).padStart(3, "0")}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-[#f3ead8]">
                    {validator.identityPubkey}
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#d6ff3f]">
                    {validator.name || "Unpublished"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full border border-[#f3ead8]/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#c9bea8]">
                      {validator.name ? "named" : "blank"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#f3ead8]/15 p-5 text-sm text-[#c9bea8]">
          Source:{" "}
          <a
            href={LEGACY_TESTNET_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-[#d6ff3f] underline decoration-[#d6ff3f]/40 underline-offset-4 transition hover:text-[#f3ead8]"
          >
            Original Solana Discord validator thread
          </a>
        </div>
      </section>
    </section>
  );
}

export default async function Home() {
  const validatorInfoSnapshot = readValidatorInfoSnapshot();
  const legacyTestnetValidators = readLegacyTestnetValidators();
  const [metricsBoard, xdpBoard] = await Promise.all(
    boardDefinitions.map((definition) =>
      fetchBoard(definition, validatorInfoSnapshot.validators),
    ),
  );

  const heroCaseDeck = buildHeroCaseDeck([metricsBoard, xdpBoard]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_10%,rgba(214,255,63,0.18),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(255,106,42,0.18),transparent_26%),linear-gradient(135deg,#11100d_0%,#17140f_52%,#24160f_100%)] px-3 py-3 text-[#f3ead8] sm:px-8 sm:py-6 lg:px-12">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(#f3ead8_1px,transparent_1px),linear-gradient(90deg,#f3ead8_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full border border-[#d6ff3f]/30 bg-[#d6ff3f]/10 blur-2xl [animation:drift_9s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-hidden opacity-20">
        <div className="h-1/2 bg-gradient-to-b from-transparent via-[#d6ff3f]/15 to-transparent [animation:scan_7s_linear_infinite]" />
      </div>

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-7 rounded-[1.25rem] border border-[#f3ead8]/15 bg-[#15120e]/85 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:gap-10 sm:rounded-[2rem] sm:p-8 lg:p-10">
        <nav className="flex flex-col gap-3 border-b border-[#f3ead8]/15 pb-5 text-xs uppercase tracking-[0.16em] text-[#918b7d] sm:flex-row sm:items-center sm:justify-between sm:text-sm sm:tracking-[0.26em]">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-[#d6ff3f] shadow-[0_0_28px_rgba(214,255,63,0.85)]" />
            Solana validator accountability registry
          </div>
          <span>XDP and metrics accountability</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[#d6ff3f]/40 bg-[#d6ff3f]/10 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#d6ff3f] sm:text-xs sm:tracking-[0.24em]">
              Validator accountability tribunal
            </p>
            <h1 className="font-display max-w-5xl text-[clamp(3.35rem,17vw,8.6rem)] font-black leading-[0.82] tracking-[-0.08em] text-[#f3ead8]">
              Agave Wall of Shame
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#c9bea8] sm:mt-7 sm:text-xl sm:leading-8">
              Hall of shame for validators on Solana mainnet not reporting
              metrics or advertising xdp=false, holding Solana back.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[1.5rem] border border-[#ff6a2a]/35 bg-[#22160f] p-5 sm:p-6">
            <div className="mb-6 inline-flex rounded-full bg-[#ff6a2a] px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#1a110c] sm:absolute sm:right-5 sm:top-5 sm:mb-0">
              live burn
            </div>
            <p className="text-sm uppercase tracking-[0.28em] text-[#918b7d]">
              current defendant
            </p>
            <h2 className="font-display mt-5 text-3xl font-black tracking-[-0.05em] text-[#d6ff3f] sm:mt-8 sm:text-4xl">
              {heroCaseDeck.currentDefendant?.name || "Identity only"}
            </h2>
            <p className="mt-4 break-all font-mono text-sm leading-6 text-[#d7cbb4]">
              {heroCaseDeck.currentDefendant?.identityPubkey ||
                "No validators currently listed."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-black/25 px-4 py-3 font-bold text-[#ffb188]">
                {heroCaseDeck.currentDefendant?.issueLabel || "Live board"}
              </span>
              <span className="rounded-full border border-[#f3ead8]/12 px-4 py-3 text-[#c9bea8]">
                {heroCaseDeck.currentDefendant?.boardTitle || "Current case"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {heroCaseDeck.caseFiles.map((caseFile, index) => {
            const theme = boardTheme(caseFile.boardKey);

            return (
              <article
                key={`${caseFile.boardKey}-${caseFile.identityPubkey}`}
                className={`group relative flex min-h-60 flex-col overflow-hidden rounded-[1.5rem] border ${theme.cardBorder} bg-[#1b1813] p-5 transition duration-300 hover:-translate-y-1 sm:min-h-64`}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#d6ff3f] via-[#ff6a2a] to-transparent opacity-70" />
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-[#918b7d]">
                  <span>case {formatCaseNumber(index + 2)}</span>
                  <span>{caseFile.issueLabel}</span>
                </div>
                <h3 className="font-display mt-8 text-2xl font-black leading-none tracking-[-0.05em] text-[#f3ead8] sm:text-3xl">
                  {caseFile.name || "Unpublished validator-info"}
                </h3>
                <p className="mt-5 break-all font-mono text-xs leading-6 text-[#c9bea8]">
                  {caseFile.identityPubkey}
                </p>
                <p className="mt-auto rounded-full border border-[#f3ead8]/15 px-4 py-3 text-sm font-bold text-[#f3ead8]">
                  {caseFile.boardTitle}
                </p>
              </article>
            );
          })}
        </div>

        <WallOfShameTabs
          mainnetTab={
            <div className="space-y-5">
              <section className="rounded-[1.5rem] border border-[#f3ead8]/15 bg-[#120f0c] p-6">
                <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-[#918b7d]">
                      operator notes
                    </p>
                    <h2 className="font-display mt-4 text-3xl font-black tracking-[-0.05em] sm:text-4xl">
                      Get off the board
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c9bea8] sm:text-base">
                      Report metrics. Enable XDP. Publish validator info if you
                      want your validator name attached to your identity instead
                      of a raw pubkey.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
                      <span className="rounded-full border border-[#d6ff3f]/25 bg-[#d6ff3f]/10 px-4 py-3 text-[#d6ff3f]">
                        Metrics {metricsBoard.count}
                      </span>
                      <span className="rounded-full border border-[#ff6a2a]/25 bg-[#ff6a2a]/10 px-4 py-3 text-[#ffb188]">
                        XDP {xdpBoard.count}
                      </span>
                      <span className="rounded-full border border-[#f3ead8]/15 px-4 py-3 text-[#f3ead8]">
                        Snapshot {formatTimestamp(validatorInfoSnapshot.generatedAt)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="space-y-3">
                      {checks.map((command) => (
                        <code
                          key={command}
                          className="block overflow-x-auto rounded-2xl border border-[#f3ead8]/10 bg-black/35 px-4 py-4 text-xs text-[#f3ead8] sm:text-sm"
                        >
                          {command}
                        </code>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3 text-sm">
                      <a
                        href={XDP_GUIDE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center rounded-full bg-[#f3ead8] px-5 py-3 font-black text-[#17140f] transition hover:bg-[#d6ff3f]"
                      >
                        Read the Agave XDP setup guide
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              <OffenderBoardTabs
                metricsBoard={renderMainnetBoard(metricsBoard)}
                xdpBoard={renderMainnetBoard(xdpBoard)}
              />
            </div>
          }
          testnetTab={renderTestnetArchive(
            legacyTestnetValidators,
            pickFeatured(legacyTestnetValidators),
          )}
        />
      </section>

      <footer className="relative mx-auto mt-6 flex max-w-7xl flex-col gap-3 px-2 text-xs uppercase tracking-[0.22em] text-[#918b7d] sm:flex-row sm:justify-between">
        <span>Solana validator accountability registry</span>
        <span>Enable XDP, report metrics, move the chain forward</span>
      </footer>
    </main>
  );
}
