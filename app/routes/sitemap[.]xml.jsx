const urls = [
  {
    loc: "https://app.w103.com/",
    changefreq: "weekly",
    priority: "1.0",
  },
  {
    loc: "https://app.w103.com/privacy",
    changefreq: "yearly",
    priority: "0.6",
  },
  {
    loc: "https://app.w103.com/terms",
    changefreq: "yearly",
    priority: "0.6",
  },
];

export const loader = () => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (url) =>
        `  <url>\n    <loc>${url.loc}</loc>\n    <changefreq>${url.changefreq}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`
    )
    .join("\n")}\n</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
};
