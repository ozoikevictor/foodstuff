export async function proxyApi(request: Request): Promise<Response> {
  const origin = process.env["API_ORIGIN"];
  if (!origin)
    return Response.json(
      { error: "The backend connection is not configured. Set API_ORIGIN on Vercel." },
      { status: 503 },
    );
  try {
    const incoming = new URL(request.url);
    const target = new URL(`${incoming.pathname}${incoming.search}`, origin);
    const headers = new Headers(request.headers);
    for (const key of [
      "host",
      "connection",
      "content-length",
      "transfer-encoding",
      "accept-encoding",
    ])
      headers.delete(key);
    const response = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
      signal: request.signal,
      ...(request.method === "GET" || request.method === "HEAD"
        ? {}
        : { body: await request.arrayBuffer() }),
    });
    const outgoing = new Headers(response.headers);
    for (const key of ["content-encoding", "content-length", "transfer-encoding", "connection"])
      outgoing.delete(key);
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json(
      { error: "Unable to reach the backend. Please try again shortly." },
      { status: 502 },
    );
  }
}
