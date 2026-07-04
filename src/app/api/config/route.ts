// Report which integrations are configured server-side (via env), so the UI can
// auto-send to Discord / skip key prompts without ever exposing the secrets.
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    discordConfigured: Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID),
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    serperConfigured: Boolean(process.env.SERPER_API_KEY),
  });
}
