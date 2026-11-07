import { APP_URL } from "./line.ts";

export async function notifyLineLinkCompletion(
  linked: boolean,
  reply: (message: string) => Promise<Response>,
): Promise<"completed" | "ignored" | "reply_failed"> {
  if (!linked) return "ignored";
  const response = await reply(
    `LINE応募通知の連携が完了しました。\nサイトはこちらから開けます。\n${APP_URL}`,
  );
  return response.ok ? "completed" : "reply_failed";
}
