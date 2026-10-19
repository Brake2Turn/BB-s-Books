// Generated stand-in covers with varied colours and proportions, keyed by ISBN.
const palette = [['#1f3b4d','#e9c46a'],['#7a2e2e','#f4e1c1'],['#2d4a3e','#d8c79a'],['#e8dcc4','#3a2a1e'],['#4b3b6b','#f0d9a8'],['#c45c3b','#fbefe0'],['#0e2a2f','#9fc5b8'],['#d9a441','#2b1d0e'],['#5b6e4f','#f1ead8'],['#283655','#f4d35e'],['#a23e48','#fdf0d5'],['#334139','#e2b07a'],['#efe6d2','#8c2f39'],['#3d5a80','#e0fbfc']];
export function coverSvg(isbn) {
  const n = [...isbn].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const [bg, fg] = palette[n % palette.length];
  const h = [600, 620, 640, 580][n % 4];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${h}"><rect width="400" height="${h}" fill="${bg}"/><circle cx="${100 + n % 200}" cy="${200 + n % 120}" r="${60 + n % 70}" fill="${fg}" opacity=".35"/><rect x="40" y="${h - 150}" width="320" height="2" fill="${fg}"/><text x="40" y="${h - 100}" font-family="Georgia" font-size="34" fill="${fg}">${isbn.slice(-4)}</text></svg>`;
}
export async function routeCovers(ctx) {
  await ctx.route(/covers\.openlibrary\.org\/b\/isbn\/(\d+)/, (r) => {
    const isbn = r.request().url().match(/isbn\/(\d+)/)[1];
    r.fulfill({ body: coverSvg(isbn), contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await ctx.route(/images-na\.ssl-images-amazon\.com/, (r) => r.fulfill({ status: 404, body: '' }));
}
