import { readFileSync } from "node:fs";
import { join } from "node:path";

type Validator = {
  identity_pubkey: string;
  name: string;
};

export const dynamic = "force-dynamic";

const checks = [
  "--experimental-retransmit-xdp-cpu-cores 1",
  "--experimental-retransmit-xdp-zero-copy # Do NOT pass this flag when using the bnxt_en driver.",
  "--experimental-poh-pinned-cpu-core 10",
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

function getValidators(): Validator[] {
  const csvPath = join(process.cwd(), "public", "validators.csv");
  const [, ...rows] = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);

  return rows.map((row) => {
    const [identity_pubkey, name] = parseCsvLine(row);
    return { identity_pubkey, name };
  });
}

export default function Home() {
  const validators = getValidators().sort((left, right) => {
    if (left.name && !right.name) return -1;
    if (!left.name && right.name) return 1;
    return (left.name || left.identity_pubkey).localeCompare(
      right.name || right.identity_pubkey,
    );
  });
  const namedValidators = validators.filter((validator) => validator.name);
  const unnamedCount = validators.length - namedValidators.length;
  const [currentDefendant, ...cardValidators] = shuffle(namedValidators).slice(
    0,
    4,
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_10%,rgba(214,255,63,0.18),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(255,106,42,0.18),transparent_26%),linear-gradient(135deg,#11100d_0%,#17140f_52%,#24160f_100%)] px-5 py-6 text-[#f3ead8] sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(#f3ead8_1px,transparent_1px),linear-gradient(90deg,#f3ead8_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full border border-[#d6ff3f]/30 bg-[#d6ff3f]/10 blur-2xl [animation:drift_9s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-hidden opacity-20">
        <div className="h-1/2 bg-gradient-to-b from-transparent via-[#d6ff3f]/15 to-transparent [animation:scan_7s_linear_infinite]" />
      </div>

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 rounded-[2rem] border border-[#f3ead8]/15 bg-[#15120e]/85 p-5 shadow-2xl shadow-black/40 backdrop-blur sm:p-8 lg:p-10">
        <nav className="flex flex-col gap-4 border-b border-[#f3ead8]/15 pb-5 text-sm uppercase tracking-[0.26em] text-[#918b7d] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-[#d6ff3f] shadow-[0_0_28px_rgba(214,255,63,0.85)]" />
            Solana testnet shame registry
          </div>
          <span>XDP and metrics accountability</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-end">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-[#d6ff3f]/40 bg-[#d6ff3f]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[#d6ff3f]">
              Validator accountability tribunal
            </p>
            <h1 className="font-display max-w-5xl text-6xl font-black leading-[0.82] tracking-[-0.08em] text-[#f3ead8] sm:text-8xl lg:text-[8.6rem]">
              XDP Hall of Shame
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#c9bea8] sm:text-xl">
              Hall of shame for all validators on Solana testnet without XDP or
              not reporting metrics, holding Solana back.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[1.5rem] border border-[#ff6a2a]/35 bg-[#22160f] p-6">
            <div className="absolute right-5 top-5 rounded-full bg-[#ff6a2a] px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#1a110c]">
              live burn
            </div>
            <p className="text-sm uppercase tracking-[0.28em] text-[#918b7d]">
              current defendant
            </p>
            <h2 className="font-display mt-8 text-4xl font-black tracking-[-0.05em] text-[#d6ff3f]">
              {currentDefendant.name}
            </h2>
            <p className="mt-4 break-all font-mono text-sm leading-6 text-[#d7cbb4]">
              {currentDefendant.identity_pubkey}
            </p>
            <div className="mt-7 text-sm">
              <span className="block rounded-2xl bg-black/25 p-4 text-[#918b7d]">
                XDP/Metrics
                <strong className="mt-2 block text-2xl text-[#ff6a2a]">
                  Missing
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cardValidators.map((validator, index) => (
            <article
              key={validator.identity_pubkey}
              className="group relative min-h-64 overflow-hidden rounded-[1.5rem] border border-[#f3ead8]/12 bg-[#1b1813] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#d6ff3f]/50"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#d6ff3f] via-[#ff6a2a] to-transparent opacity-70" />
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-[#918b7d]">
                <span>case {String(index + 2).padStart(3, "0")}</span>
                <span>XDP No</span>
              </div>
              <h3 className="font-display mt-8 text-3xl font-black leading-none tracking-[-0.05em] text-[#f3ead8]">
                {validator.name}
              </h3>
              <p className="mt-5 break-all font-mono text-xs leading-6 text-[#c9bea8]">
                {validator.identity_pubkey}
              </p>
              <p className="absolute bottom-5 left-5 right-5 rounded-full border border-[#f3ead8]/15 px-4 py-3 text-sm font-bold text-[#d6ff3f]">
                XDP No
              </p>
            </article>
          ))}
        </div>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[1.5rem] bg-[#d6ff3f] p-6 text-[#17140f]">
            <p className="text-sm font-black uppercase tracking-[0.24em]">
              validator payload
            </p>
            <h2 className="font-display mt-5 text-5xl font-black leading-none tracking-[-0.06em]">
              {validators.length} Solana testnet identities
            </h2>
            <div className="mt-7 grid grid-cols-2 gap-3 text-sm font-bold">
              <span className="rounded-2xl bg-[#17140f] p-4 text-[#d6ff3f]">
                Named
                <strong className="block text-3xl text-[#f3ead8]">
                  {namedValidators.length}
                </strong>
              </span>
              <span className="rounded-2xl bg-[#17140f] p-4 text-[#d6ff3f]">
                Anonymous
                <strong className="block text-3xl text-[#f3ead8]">
                  {unnamedCount}
                </strong>
              </span>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#f3ead8]/15 bg-[#120f0c] p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-[#918b7d]">
              setup flags
            </p>
            <h2 className="font-display mt-4 text-4xl font-black tracking-[-0.05em]">
              Stop holding the network back
            </h2>
            <div className="mt-6 space-y-3">
              {checks.map((command) => (
                <code
                  key={command}
                  className="block overflow-x-auto rounded-2xl border border-[#f3ead8]/10 bg-black/35 px-4 py-4 text-sm text-[#f3ead8]"
                >
                  {command}
                </code>
              ))}
            </div>
            <a
              href="https://www.anza.xyz/blog/agave-xdp-setup-guide"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-full bg-[#f3ead8] px-5 py-3 text-sm font-black text-[#17140f] transition hover:bg-[#d6ff3f]"
            >
              Read the Agave XDP setup guide
            </a>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-[#f3ead8]/15 bg-[#0d0b09]">
          <div className="flex flex-col gap-4 border-b border-[#f3ead8]/15 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[#918b7d]">
                main ledger
              </p>
              <h2 className="font-display mt-2 text-4xl font-black tracking-[-0.05em]">
                Validator identities and names
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#c9bea8]">
              All {validators.length} identities loaded.
            </p>
          </div>
          <div className="max-h-[620px] overflow-auto">
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
                    key={validator.identity_pubkey}
                    className="border-b border-[#f3ead8]/8 transition hover:bg-[#d6ff3f]/5"
                  >
                    <td className="px-5 py-4 font-bold text-[#918b7d]">
                      {String(index + 1).padStart(3, "0")}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-[#f3ead8]">
                      {validator.identity_pubkey}
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
            Source: {" "}
            <a
              href="https://discord.com/channels/428295358100013066/849749936916267029/1506864933353160767"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[#d6ff3f] underline decoration-[#d6ff3f]/40 underline-offset-4 transition hover:text-[#f3ead8]"
            >
              Solana Discord validator list
            </a>
          </div>
        </section>
      </section>

      <footer className="relative mx-auto mt-6 flex max-w-7xl flex-col gap-3 px-2 text-xs uppercase tracking-[0.22em] text-[#918b7d] sm:flex-row sm:justify-between">
        <span>built for Vercel</span>
        <span>enable XDP, report metrics, move the chain forward</span>
      </footer>
    </main>
  );
}
