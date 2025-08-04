import { Hono } from "hono";
import { scheduledHandler } from "./scheduler";
import { getLatestOxrResponseByDate } from "./bucket";

const app = new Hono<{ Bindings: CloudflareBindings }>();

const api = new Hono<{ Bindings: CloudflareBindings }>();

api.get("/latest", async (c) => {
  const object = await getLatestOxrResponseByDate(new Date(), c.env);
  if (!object) {
    return c.json({ error: "Not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "application/json");
  headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
});

app.route("/api", api);
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
