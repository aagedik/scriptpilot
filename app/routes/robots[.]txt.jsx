export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  const robots = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;

  return new Response(robots, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
};
