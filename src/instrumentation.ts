// بيشتغل مرة واحدة لما السيرفر يقوم (Next instrumentation)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { onServerStart } = await import("./instrumentation-node");
    onServerStart();
  }
}
